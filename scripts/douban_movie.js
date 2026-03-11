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
const MOVIE_DELAY = 100;

const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'douban_movie_data.json');

// 日志辅助函数
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    step: (msg) => console.log(`\n\x1b[35m===> ${msg}\x1b[0m`)
};

// ================= 核心逻辑 =================

/**
 * 匹配 TMDB 数据
 * 逻辑：优先使用 TMDB，只有封面/海报不存在时才用豆瓣补全
 */
async function getAccurateMovieData(doubanItem) {
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
        // 寻找完全匹配或取第一个
        const exactMatch = results.find(m => (m.title === title || m.original_title === originalTitle)) || (results.length > 0 ? results[0] : null);

        if (exactMatch) {
            const genreTitle = (exactMatch.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',') || doubanItem.genres.join(',');
            
            return {
                id: exactMatch.id,
                db_id: doubanItem.id,
                type: "tmdb",
                title: exactMatch.title || title,
                description: exactMatch.overview || doubanItem.summary || "",
                rating: exactMatch.vote_average || doubanItem.rating.average,
                voteCount: exactMatch.vote_count || 0,
                popularity: exactMatch.popularity || 0,
                releaseDate: exactMatch.release_date || doubanItem.year,
                // 核心逻辑：只有当 TMDB 路径为空时，才回退到豆瓣图片
                posterPath: exactMatch.poster_path ? `https://image.tmdb.org/t/p/w500${exactMatch.poster_path}` : doubanItem.images.large,
                backdropPath: exactMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${exactMatch.backdrop_path}` : "",
                mediaType: "movie",
                genreTitle: genreTitle
            };
        }
    } catch (err) {
        log.warn(`TMDB 匹配失败 [${title}]: ${err.message}`);
    }

    // 彻底匹配不到 TMDB 时的 fallback
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

async function fetchAndSync(endpoint) {
    let allSubjects = [];
    let start = 0;
    const isTop250 = endpoint === 'top250';

    log.step(`开始同步分类: ${endpoint.toUpperCase()}`);

    while (true) {
        try {
            process.stdout.write(`   正在拉取豆瓣分页 [${start}]... \r`);
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

            if (!isTop250 || allSubjects.length >= (res.data.total || 250)) break;

            start += MAX_COUNT;
            await new Promise(r => setTimeout(r, 600)); 
        } catch (err) {
            log.error(`分页请求异常: ${err.message}`);
            break;
        }
    }

    log.info(`豆瓣拉取完成，共 ${allSubjects.length} 条。开始 TMDB 匹配补全...`);
    
    const results = [];
    for (let i = 0; i < allSubjects.length; i++) {
        const item = allSubjects[i];
        const matched = await getAccurateMovieData(item);
        results.push(matched);
        
        // 打印实时处理进度
        const percent = (((i + 1) / allSubjects.length) * 100).toFixed(0);
        process.stdout.write(`   进度: [${percent}%] 正在处理: ${item.title.padEnd(15).substring(0, 15)}\r`);
        
        await new Promise(r => setTimeout(r, MOVIE_DELAY));
    }
    process.stdout.write('\n');
    log.success(`${endpoint} 处理完毕，匹配成功率: ${((results.filter(r => r.type === 'tmdb').length / results.length) * 100).toFixed(1)}%`);
    
    return results;
}

async function main() {
    const startTime = Date.now();
    log.info("🎬 电影数据采集任务启动...");

    try {
        const finalResult = {
            updated_at: new Date().toISOString(),
            now_playing: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log.step(`任务圆满完成!`);
        console.log(`--------------------------------------`);
        console.log(`📊 总计耗时: ${duration}s`);
        console.log(`📂 存储路径: ${FILE_PATH}`);
        console.log(`📦 数据总量: ${finalResult.in_theaters.length + finalResult.coming_soon.length + finalResult.top250.length} 条`);
        console.log(`--------------------------------------`);

    } catch (mainErr) {
        log.error(`主流程崩溃: ${mainErr.stack}`);
    }
}

main();
