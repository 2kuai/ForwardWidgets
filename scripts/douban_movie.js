const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";
// 类型映射表
const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部"
};
// 分页/超时配置（可按需调整）
const PAGE_SIZE = 20; // 豆瓣API单页请求数
const MAX_PAGE = 100; // 兜底最大页数，防死循环
const REQUEST_TIMEOUT = 15000; // 所有请求超时时间(ms)
const PAGE_DELAY = 500; // 每页处理完后延迟，防API限流
const MOVIE_DELAY = 150; // 单个电影处理延迟（可选保留）
// 数据存储配置
const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'douban_movie_data.json');

// ================= 核心逻辑 =================
/**
 * 核心匹配逻辑：TMDB 优先 -> 失败则回退至 Douban 数据
 * @param {Object} doubanItem 豆瓣原始电影数据
 * @returns {Object} 标准化后的电影数据
 */
async function getAccurateMovieData(doubanItem) {
    const title = doubanItem.title;
    const originalTitle = doubanItem.original_title;
    const year = parseInt(doubanItem.year);

    try {
        // 1. 尝试从 TMDB 获取数据（加超时）
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: originalTitle || title,
                language: 'zh-CN',
                primary_release_year: year
            },
            headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` },
            timeout: REQUEST_TIMEOUT
        });

        const results = searchRes.data.results || [];
        const exactMatch = results.find(m => {
            const tmdbYear = m.release_date ? new Date(m.release_date).getFullYear() : null;
            return (m.title === title || m.original_title === originalTitle) && tmdbYear === year;
        }) || (results.length > 0 ? results[0] : null);

        if (exactMatch) {
            console.log(`    ✅ [TMDB] 匹配成功: ${exactMatch.title}`);
            const genreTitle = (exactMatch.genre_ids || [])
                .map(id => GENRE_MAP[id])
                .filter(Boolean)
                .join(',') || doubanItem.genres.join(',');
            return {
                id: exactMatch.id,
                type: "tmdb",
                title: exactMatch.title || title,
                description: exactMatch.overview || "",
                rating: exactMatch.vote_average || doubanItem.rating.average,
                releaseDate: exactMatch.release_date || doubanItem.year,
                posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : doubanItem.images.large,
                backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${exactMatch.backdrop_path}` : "",
                mediaType: "movie",
                genreTitle: genreTitle
            };
        }
    } catch (err) {
        console.warn(`    ⚠️ [TMDB] 请求异常: ${err.message}`);
    }

    // 2. 回退机制：TMDB 失败，返回豆瓣原生数据
    console.log(`    ℹ️ [DOUBAN] 使用豆瓣备份数据: ${title}`);
    return {
        id: doubanItem.id,
        type: "douban",
        title: title,
        description: doubanItem.summary || "暂无简介",
        rating: doubanItem.rating.average,
        releaseDate: doubanItem.year,
        posterPath: doubanItem.images.large,
        backdropPath: "",
        mediaType: "movie",
        genreTitle: doubanItem.genres.join(',')
    };
}

/**
 * 分页拉取豆瓣电影数据（重构最优分页逻辑）
 * @param {string} endpoint 豆瓣API接口（in_theaters/coming_soon/top250）
 * @returns {Array} 去重后的标准化电影数据
 */
async function fetchAndSync(endpoint) {
    const movieMap = new Map(); // 唯一ID去重
    const requestBody = { apikey: DOUBAN_API_KEY };
    const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' };
    let start = 0; // 分页偏移量
    let currentPage = 0; // 当前页数（用于兜底/日志）

    console.log(`\n========================================`);
    console.log(`🚀 开始同步分类: ${endpoint}`);
    console.log(`========================================`);

    // 尝试获取理论总数（仅用于日志，不依赖循环）
    try {
        const init = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
            params: { start: 0, count: 1 },
            headers: commonHeaders,
            timeout: REQUEST_TIMEOUT
        });
        const total = init.data.total || 0;
        console.log(`[豆瓣] 理论数据总量: ${total}`);
    } catch (initErr) {
        console.warn(`⚠️ [豆瓣] 获取总数失败，直接开始分页请求: ${initErr.message}`);
    }

    // 核心：动态while分页循环（替代固定for循环）
    while (true) {
        // 兜底终止：超过最大页数，强制退出
        if (currentPage >= MAX_PAGE) {
            console.log(`[分页] 已达最大页数${MAX_PAGE}，强制终止`);
            break;
        }
        currentPage++;
        console.log(`\n[分页] 第${currentPage}页 | start=${start} 开始请求...`);

        try {
            // 拉取当前页豆瓣数据（加超时）
            const res = await axios.post(`${BASE_URL}/${endpoint}`, requestBody, {
                params: { start: start, count: PAGE_SIZE },
                headers: commonHeaders,
                timeout: REQUEST_TIMEOUT
            });
            const subjects = res.data.subjects || [];

            // 主动终止：无有效数据，退出循环
            if (!Array.isArray(subjects) || subjects.length === 0) {
                console.log(`[分页] 第${currentPage}页返回空数据，无更多内容`);
                break;
            }

            // 处理当前页所有电影
            for (const item of subjects) {
                const data = await getAccurateMovieData(item);
                if (data && !movieMap.has(data.id)) {
                    movieMap.set(data.id, data);
                }
                // 单个电影延迟（可选，怕限流可保留）
                await new Promise(r => setTimeout(r, MOVIE_DELAY));
            }

            // 翻页准备：偏移量自增
            start += PAGE_SIZE;
            // 整页处理完延迟，减少总耗时+防限流
            await new Promise(r => setTimeout(r, PAGE_DELAY));

        } catch (pageErr) {
            // 单页异常容错：仅跳过当前页，继续下一页
            console.warn(`⚠️ [分页] 第${currentPage}页请求失败，跳过该页: ${pageErr.message}`);
            start += PAGE_SIZE; // 偏移量自增，避免重复请求失败页
            continue;
        }
    }

    console.log(`[分页] ${endpoint} 同步完成，实际获取有效数据: ${movieMap.size}条`);
    return Array.from(movieMap.values());
}

/**
 * 主入口：串行执行所有分类同步，写入JSON文件
 */
async function main() {
    const startTime = Date.now();
    try {
        // 串行执行，保证日志清晰、避免API并发限流
        const finalResult = {
            in_theaters: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        // 写入本地JSON文件（格式化输出）
        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        console.log(`\n📁 数据已成功写入: ${FILE_PATH}`);

        // 统计耗时和结果
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n****************************************`);
        console.log(`🏁 全部同步任务完成! 总耗时: ${duration}s`);
        console.log(`📊 最终统计结果（已去重）:`);
        console.log(`   - 正在热映: ${finalResult.in_theaters.length}条`);
        console.log(`   - 即将上映: ${finalResult.coming_soon.length}条`);
        console.log(`   - Top 250: ${finalResult.top250.length}条`);
        console.log(`****************************************`);

    } catch (mainErr) {
        console.error(`\n❌ 主流程执行失败: ${mainErr.message}`, mainErr.stack);
        process.exit(1); // 异常退出进程
    }
}

// 执行主入口
main();