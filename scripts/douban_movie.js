const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = process.env.DOUBAN_API_KEY;
const BASE_URL = "https://api.douban.com/v2/movie";

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部"
};

const MAX_COUNT = 100;
const REQUEST_TIMEOUT = 15000;
const MOVIE_DELAY = 150; 

const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'tmdb_clean_data.json');

const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    step: (msg) => console.log(`\n\x1b[35m===> ${msg}\x1b[0m`)
};

// ================= 核心逻辑 =================

/**
 * 严格匹配 TMDB 数据
 * 逻辑：只保留 TMDB 存在的电影。
 * 路径：仅保留原始 Path（不含 https://...）
 */
async function getStrictTMDBData(doubanItem) {
    const title = doubanItem.title;
    const originalTitle = doubanItem.original_title;
    const year = parseInt(doubanItem.year);

    try {
        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: originalTitle || title,
                language: 'zh-CN',
                primary_release_year: year
            },
            headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` },
            timeout: 10000
        });

        const results = searchRes.data.results || [];
        // 寻找匹配项
        const match = results.find(m => (m.title === title || m.original_title === originalTitle)) || (results.length > 0 ? results[0] : null);

        // 如果 TMDB 没找到，或者 TMDB 连最基本的 poster_path 都没有，直接弃用该数据
        if (match && match.poster_path) {
            return {
                id: match.id,
                db_id: doubanItem.id,
                title: match.title || title,
                description: match.overview || "",
                rating: match.vote_average,
                voteCount: match.vote_count,
                popularity: match.popularity,
                releaseDate: match.release_date || doubanItem.year,
                // 只保留原始路径，例如: "/or1hfS0u7l2ALpXbs76Zp7S09pU.jpg"
                posterPath: match.poster_path, 
                backdropPath: match.backdrop_path || "",
                mediaType: "movie",
                genreTitle: (match.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',')
            };
        }
    } catch (err) {
        // 忽略错误，返回 null 会在下一步被过滤
    }

    return null; 
}

async function fetchAndSync(endpoint) {
    let allSubjects = [];
    let start = 0;

    log.step(`正在筛选分类: ${endpoint.toUpperCase()}`);

    while (true) {
        try {
            process.stdout.write(`   同步豆瓣种子 [${start}]... \r`);
            const res = await axios.post(`${BASE_URL}/${endpoint}`, {
                apikey: DOUBAN_API_KEY,
                start: start,
                count: MAX_COUNT
            }, {
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17_0 like Mac OS X)' },
                timeout: REQUEST_TIMEOUT
            });

            const subjects = res.data.subjects || [];
            if (subjects.length === 0) break;
            allSubjects = allSubjects.concat(subjects);

            if (endpoint !== 'top250' || allSubjects.length >= (res.data.total || 250)) break;
            start += MAX_COUNT;
            await new Promise(r => setTimeout(r, 600)); 
        } catch (err) {
            log.error(`获取列表失败: ${err.message}`);
            break;
        }
    }

    log.info(`种子获取完成，开始 TMDB 纯净度过滤...`);
    
    const results = [];
    for (let i = 0; i < allSubjects.length; i++) {
        const item = allSubjects[i];
        const matched = await getStrictTMDBData(item);
        
        if (matched) {
            results.push(matched);
        }
        
        const percent = (((i + 1) / allSubjects.length) * 100).toFixed(0);
        process.stdout.write(`   进度: [${percent}%] 有效条目: ${results.length}\r`);
        
        await new Promise(r => setTimeout(r, MOVIE_DELAY));
    }
    process.stdout.write('\n');
    log.success(`${endpoint} 处理完毕，剔除了 ${allSubjects.length - results.length} 条不合格数据`);
    
    return results;
}

async function main() {
    const startTime = Date.now();
    log.info("🎬 启动 TMDB 纯净数据采集 (无前缀模式)...");

    try {
        const finalResult = {
            updated_at: new Date().toISOString(),
            now_playing: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log.step(`任务圆满成功!`);
        console.log(`--------------------------------------`);
        console.log(`📦 总有效数据: ${finalResult.now_playing.length + finalResult.coming_soon.length + finalResult.top250.length} 条`);
        console.log(`📂 文件保存至: ${FILE_PATH}`);
        console.log(`⏱️ 运行耗时: ${duration}s`);
        console.log(`--------------------------------------`);

    } catch (mainErr) {
        log.error(`主程序故障: ${mainErr.stack}`);
    }
}

main();
