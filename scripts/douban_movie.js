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
const MOVIE_DELAY = 150; // 毫秒间隔，避免请求过快

const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'movie_data_combined.json');

// 日志辅助
const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    step: (msg) => console.log(`\n\x1b[35m===> ${msg}\x1b[0m`)
};

// ================= 核心逻辑 =================

/**
 * 匹配 TMDB 数据，并实现图片静默补位
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
        // 寻找匹配：优先原名匹配，否则取第一个
        const match = results.find(m => (m.title === title || m.original_title === originalTitle)) || (results.length > 0 ? results[0] : null);

        if (match) {
            return {
                id: match.id,
                db_id: doubanItem.id,
                title: match.title || title,
                description: match.overview || doubanItem.summary || "",
                rating: match.vote_average || doubanItem.rating.average,
                voteCount: match.vote_count || 0,
                releaseDate: match.release_date || doubanItem.year,
                // 核心逻辑：TMDB 没图就用豆瓣大图补位
                posterPath: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : doubanItem.images.large,
                backdropPath: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : "",
                mediaType: "movie",
                genreTitle: (match.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',') || doubanItem.genres.join(',')
            };
        }
    } catch (err) {
        log.warn(`TMDB 查询异常 [${title}]: ${err.message}`);
    }

    // 彻底搜不到时，将豆瓣数据转化为 TMDB 兼容格式
    return {
        id: `db_${doubanItem.id}`,
        db_id: doubanItem.id,
        title: title,
        description: doubanItem.summary || "暂无简介",
        rating: doubanItem.rating.average,
        voteCount: doubanItem.collect_count || 0,
        releaseDate: doubanItem.year,
        posterPath: doubanItem.images.large, // 强制回退豆瓣封面
        backdropPath: "", 
        mediaType: "movie",
        genreTitle: doubanItem.genres.join(',')
    };
}

/**
 * 抓取并同步单个分类
 */
async function fetchAndSync(endpoint) {
    let allSubjects = [];
    let start = 0;

    log.step(`正在抓取豆瓣分类: ${endpoint.toUpperCase()}`);

    while (true) {
        try {
            process.stdout.write(`   正在获取列表数据 [OFFSET: ${start}]... \r`);
            const res = await axios.post(`${BASE_URL}/${endpoint}`, {
                apikey: DOUBAN_API_KEY,
                start: start,
                count: MAX_COUNT
            }, {
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU OS 17.0 like Mac OS X)' },
                timeout: REQUEST_TIMEOUT
            });

            const subjects = res.data.subjects || [];
            if (subjects.length === 0) break;
            allSubjects = allSubjects.concat(subjects);

            // 非 Top250 分类通常不需要深度分页
            if (endpoint !== 'top250' || allSubjects.length >= (res.data.total || 250)) break;

            start += MAX_COUNT;
            await new Promise(r => setTimeout(r, 600)); 
        } catch (err) {
            log.error(`列表请求异常: ${err.message}`);
            break;
        }
    }

    log.info(`列表获取完成 (${allSubjects.length} 条)，开始进行数据清洗与补全...`);
    
    const results = [];
    for (let i = 0; i < allSubjects.length; i++) {
        const item = allSubjects[i];
        const processedItem = await getAccurateMovieData(item);
        
        results.push(processedItem);
        
        const percent = (((i + 1) / allSubjects.length) * 100).toFixed(0);
        process.stdout.write(`   进度: [${percent}%] 处理中: ${item.title.substring(0, 10).padEnd(10)}\r`);
        
        await new Promise(r => setTimeout(r, MOVIE_DELAY));
    }
    process.stdout.write('\n');
    log.success(`${endpoint} 同步完成，有效条目: ${results.length}`);
    
    return results;
}

/**
 * 入口函数
 */
async function main() {
    const startTime = Date.now();
    log.info("🚀 启动电影数据全量采集任务...");

    try {
        const finalResult = {
            updated_at: new Date().toISOString(),
            now_playing: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log.step(`任务圆满结束!`);
        console.log(`--------------------------------------`);
        console.log(`⏱️ 总计耗时: ${duration}s`);
        console.log(`📂 输出文件: ${FILE_PATH}`);
        console.log(`🎬 数据总量: ${finalResult.now_playing.length + finalResult.coming_soon.length + finalResult.top250.length} 条`);
        console.log(`--------------------------------------`);

    } catch (mainErr) {
        log.error(`脚本运行故障: ${mainErr.stack}`);
    }
}

main();
