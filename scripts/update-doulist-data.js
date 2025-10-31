import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置常量
const CONFIG = {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    TMDB_BASE_URL: 'https://api.themoviedb.org/3/search/multi',
    OUTPUT_FILE: path.join(__dirname, '..', 'data', 'doulist-data.json'),
    
    // 豆瓣请求配置
    DOUBAN: {
        maxRequests: 10,
        timeWindow: 60000,
        minInterval: 1000
    },
    
    // TMDB请求间隔
    TMDB_INTERVAL: 500,
    
    // 列表间延迟
    LIST_INTERVAL: 2000
};

// 豆瓣列表配置
const DOUBAN_LISTS = [
    // 片单 (纯数字ID)
    { name: "高分韩剧", id: "2942804" },
    { name: "惊悚恐怖片", id: "526461" },
    
    // 合集 (包含字母的ID)
    { name: "一周电影口碑榜", id: "movie_weekly_best" },
    { name: "华语口碑剧集榜", id: "tv_chinese_best_weekly" }
];

// 请求管理器
class RequestManager {
    constructor(config) {
        this.config = config;
        this.requestQueue = [];
        this.lastRequestTime = 0;
    }

    async makeRequest(url, options = {}) {
        await this.waitForRateLimit();
        
        console.log(`发起请求: ${this.getShortUrl(url)}`);
        return axios.get(url, {
            headers: this.getDefaultHeaders(),
            timeout: 10000,
            ...options
        });
    }

    async waitForRateLimit() {
        const now = Date.now();
        
        // 清理过期请求
        this.requestQueue = this.requestQueue.filter(
            time => now - time < this.config.timeWindow
        );
        
        // 检查速率限制
        if (this.requestQueue.length >= this.config.maxRequests) {
            const oldestRequest = this.requestQueue[0];
            const timeToWait = this.config.timeWindow - (now - oldestRequest);
            
            if (timeToWait > 0) {
                console.log(`速率限制，等待 ${Math.ceil(timeToWait / 1000)} 秒...`);
                await this.delay(timeToWait);
                this.requestQueue = this.requestQueue.filter(
                    time => Date.now() - time < this.config.timeWindow
                );
            }
        }
        
        // 确保最小请求间隔
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.config.minInterval) {
            await this.delay(this.config.minInterval - timeSinceLastRequest);
        }
        
        this.requestQueue.push(Date.now());
        this.lastRequestTime = Date.now();
        
        console.log(`当前窗口请求数: ${this.requestQueue.length}/${this.config.maxRequests}`);
    }

    getDefaultHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
            'Referer': 'https://m.douban.com/'
        };
    }

    getShortUrl(url) {
        return url.length > 100 ? url.substring(0, 100) + '...' : url;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 豆瓣列表处理器
class DoubanListProcessor {
    constructor(requestManager) {
        this.requestManager = requestManager;
    }

    // 判断列表类型
    getListType(listId) {
        return /^\d+$/.test(listId) ? 'doulist' : 'subject_collection';
    }

    // 解析豆瓣标题
    parseTitle(doubanTitle) {
        const match = doubanTitle.match(/^(.*?)(?:\((\d{4})\))?$/);
        return match ? {
            title: match[1].trim(),
            year: match[2] || null
        } : { title: doubanTitle.trim(), year: null };
    }

    // 处理片单
    async processDoulist(listId, listName) {
        console.log(`\n📋 处理片单: ${listName}`);
        
        const items = [];
        let start = 0;
        const pageSize = 25;
        let pageCount = 0;

        while (true) {
            pageCount++;
            const pageUrl = start === 0 
                ? `https://m.douban.com/doulist/${listId}/`
                : `https://m.douban.com/doulist/${listId}/?start=${start}`;
            
            console.log(`📄 获取第 ${pageCount} 页`);
            
            try {
                const response = await this.requestManager.makeRequest(pageUrl);
                const $ = cheerio.load(response.data);
                const pageItems = $('ul.doulist-items > li');
                
                if (pageItems.length === 0) break;
                
                pageItems.each((index, element) => {
                    const title = $(element).find('.info .title').text().trim();
                    const meta = $(element).find('.info .meta').text().trim();
                    const yearMatch = meta.match(/(\d{4})(?=-\d{2}-\d{2})/);
                    const year = yearMatch?.[1] || '';
                    
                    items.push({
                        title: year ? `${title}(${year})` : title,
                        rawTitle: title,
                        year: year || null
                    });
                });
                
                console.log(`✅ 第 ${pageCount} 页: ${pageItems.length} 个项目`);
                
                if (pageItems.length < pageSize) break;
                start += pageSize;
                
            } catch (error) {
                console.error(`❌ 第 ${pageCount} 页失败:`, error.message);
                break;
            }
        }
        
        console.log(`🎯 片单完成: ${pageCount} 页, ${items.length} 个项目`);
        return { items, totalPages: pageCount, pageSize };
    }

    // 处理合集
    async processSubjectCollection(listId, listName) {
        console.log(`\n🎬 处理合集: ${listName}`);
        
        const apiUrl = `https://m.douban.com/rexxar/api/v2/subject_collection/${listId}/items?start=0&count=1000&items_only=1&for_mobile=1`;
        
        try {
            const response = await this.requestManager.makeRequest(apiUrl);
            const items = response.data?.subject_collection_items || [];
            
            const processedItems = items.map(item => ({
                title: item.year ? `${item.title}(${item.year})` : item.title,
                rawTitle: item.title || '',
                year: item.year || null,
                doubanId: item.id
            }));
            
            console.log(`✅ 合集完成: ${processedItems.length} 个项目`);
            return { items: processedItems, totalPages: 1, pageSize: 1000 };
            
        } catch (error) {
            console.error(`❌ 合集处理失败:`, error.message);
            return { items: [], totalPages: 0, pageSize: 1000 };
        }
    }

    // 统一处理列表
    async processList(listConfig) {
        const { id, name } = listConfig;
        const listType = this.getListType(id);
        
        console.log(`\n🔍 检测列表类型: ${listType}`);
        
        const processor = listType === 'doulist' 
            ? this.processDoulist.bind(this, id, name)
            : this.processSubjectCollection.bind(this, id, name);
        
        return await processor();
    }
}

// TMDB搜索器
class TMDBSearcher {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async search(title, year = null) {
        if (!this.apiKey) {
            console.error('❌ TMDB API Key 未设置');
            return null;
        }

        console.log(`🔎 搜索TMDB: ${title}${year ? ` (${year})` : ''}`);
        
        try {
            const params = {
                query: title,
                language: 'zh-CN',
                include_adult: false
            };

            const response = await axios.get(this.baseUrl, {
                params,
                headers: { Authorization: `Bearer ${this.apiKey}` },
                timeout: 10000
            });
            
            return this.processResults(response.data, title, year);
            
        } catch (error) {
            console.error(`❌ TMDB搜索失败:`, error.message);
            return null;
        }
    }

    processResults(data, originalTitle, year) {
        if (!data.results?.length) {
            console.log(`📭 无TMDB结果: ${originalTitle}`);
            return null;
        }

        // 过滤电影和电视剧
        const mediaResults = data.results.filter(result => 
            result.media_type === 'movie' || result.media_type === 'tv'
        );
        
        if (mediaResults.length === 0) {
            console.log(`🎬 无媒体结果: ${originalTitle}`);
            return null;
        }

        // 寻找精确匹配
        const exactMatch = mediaResults.find(result => {
            const resultTitle = result.title || result.name;
            const titleMatch = resultTitle.trim().toLowerCase() === originalTitle.trim().toLowerCase();
            
            if (year) {
                const releaseDate = result.release_date || result.first_air_date;
                const resultYear = releaseDate ? new Date(releaseDate).getFullYear() : null;
                return titleMatch && resultYear === parseInt(year);
            }
            return titleMatch;
        });

        const bestMatch = exactMatch || mediaResults[0];
        const matchType = exactMatch ? '精确' : '最佳';
        
        console.log(`✅ ${matchType}匹配: ${originalTitle} → ${bestMatch.title || bestMatch.name}`);
        
        return this.formatResult(bestMatch);
    }

    formatResult(match) {
        return {
            id: match.id,
            type: "tmdb",
            title: match.title || match.name,
            description: match.overview,
            posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
            backdropPath: match.backdrop_path ? `https://image.tmdb.org/t/p/w500${match.backdrop_path}` : null,
            releaseDate: match.release_date || match.first_air_date,
            rating: match.vote_average,
            mediaType: match.media_type
        };
    }
}

// 主处理器
class MainProcessor {
    constructor(doubanProcessor, tmdbSearcher, config) {
        this.doubanProcessor = doubanProcessor;
        this.tmdbSearcher = tmdbSearcher;
        this.config = config;
    }

    async processAllLists(lists) {
        console.log(`🚀 开始处理 ${lists.length} 个列表`);
        
        const results = [];
        
        for (const [index, listConfig] of lists.entries()) {
            console.log(`\n📊 进度: ${index + 1}/${lists.length}`);
            
            const result = await this.processSingleList(listConfig);
            results.push(result);
            
            // 列表间延迟
            if (index < lists.length - 1) {
                console.log(`⏳ 等待 ${this.config.LIST_INTERVAL / 1000} 秒...`);
                await this.delay(this.config.LIST_INTERVAL);
            }
        }
        
        return this.formatFinalResults(results, lists.length);
    }

    async processSingleList(listConfig) {
        const { id, name } = listConfig;
        
        try {
            // 获取豆瓣项目
            const doubanResult = await this.doubanProcessor.processList(listConfig);
            const doubanItems = doubanResult.items;
            
            if (doubanItems.length === 0) {
                return this.createErrorResult(id, name, '无项目数据');
            }
            
            console.log(`🔄 开始处理 ${doubanItems.length} 个项目...`);
            
            // 处理TMDB匹配
            const tmdbResults = [];
            for (const [index, item] of doubanItems.entries()) {
                try {
                    const { title: cleanTitle, year } = this.doubanProcessor.parseTitle(item.title);
                    const tmdbData = await this.tmdbSearcher.search(cleanTitle, year);
                    
                    await this.delay(this.config.TMDB_INTERVAL);
                    
                    if (tmdbData) {
                        tmdbResults.push({ doubanTitle: item.title, tmdbData });
                        console.log(`✅ ${index + 1}/${doubanItems.length}: 匹配成功`);
                    } else {
                        console.log(`❌ ${index + 1}/${doubanItems.length}: 无匹配`);
                    }
                    
                } catch (error) {
                    console.error(`⚠️ 项目 ${index + 1} 处理失败:`, error.message);
                }
            }
            
            return this.createSuccessResult(id, name, tmdbResults, doubanResult);
            
        } catch (error) {
            console.error(`💥 列表处理失败:`, error.message);
            return this.createErrorResult(id, name, error.message);
        }
    }

    createSuccessResult(id, name, tmdbResults, doubanResult) {
        const successRate = doubanResult.items.length > 0 
            ? ((tmdbResults.length / doubanResult.items.length) * 100).toFixed(1)
            : 0;
            
        return {
            [id]: {
                name,
                shows: tmdbResults.map(r => r.tmdbData),
                totalItems: doubanResult.items.length,
                totalPages: doubanResult.totalPages,
                successfulMatches: tmdbResults.length,
                successRate: `${successRate}%`
            }
        };
    }

    createErrorResult(id, name, error) {
        return {
            [id]: {
                name,
                shows: [],
                totalItems: 0,
                totalPages: 0,
                successfulMatches: 0,
                error
            }
        };
    }

    formatFinalResults(results, totalLists) {
        const finalData = {
            last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
            total_lists: totalLists,
        };

        console.log('\n📈 最终统计:');
        results.forEach(result => {
            const listId = Object.keys(result)[0];
            finalData[listId] = result[listId];
            
            const listData = result[listId];
            console.log(`- ${listId}: ${listData.successfulMatches}/${listData.totalItems} 匹配 (${listData.successRate})`);
        });
        
        return finalData;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 主函数
async function main() {
    try {
        console.log('🎬 豆瓣数据更新开始...');
        
        // 初始化组件
        const requestManager = new RequestManager(CONFIG.DOUBAN);
        const doubanProcessor = new DoubanListProcessor(requestManager);
        const tmdbSearcher = new TMDBSearcher(CONFIG.TMDB_API_KEY, CONFIG.TMDB_BASE_URL);
        const mainProcessor = new MainProcessor(doubanProcessor, tmdbSearcher, CONFIG);
        
        // 处理所有列表
        const finalData = await mainProcessor.processAllLists(DOUBAN_LISTS);
        
        // 保存数据
        await fs.mkdir(path.dirname(CONFIG.OUTPUT_FILE), { recursive: true });
        await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf8');
        
        console.log(`\n💾 数据已保存至: ${CONFIG.OUTPUT_FILE}`);
        console.log('🎉 数据更新完成!');
        
    } catch (error) {
        console.error('💥 程序执行失败:', error);
        process.exit(1);
    }
}

// 执行
if (import.meta.url === `file://${process.argv[1]}`) {
    main().then(() => process.exit(0));
}
