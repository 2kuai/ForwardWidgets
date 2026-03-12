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
const FILE_PATH = path.join(dir, 'douban_movie_data.json');

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
 * 逻辑：只返回 TMDB 存在的数据，TMDB 没封面时才用豆瓣封面兜底
 */
async function getStrictTMDBData(doubanItem) {
    const title = doubanItem.title;
    const originalTitle = doubanItem.original_title;
    const year = parseInt(doubanItem.year);
    const searchQuery = originalTitle || title;

    try {
        // 新增：打印当前检索进度
        process.stdout.write(`   🔍 匹配中: <${title}> (${year})... `);

        const searchRes = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
            params: {
                query: searchQuery,
                language: 'zh-CN'
            },
            headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` },
            timeout: 10000
        });

        const results = searchRes.data.results || [];
        
        // 保持原逻辑：只找标题严格一致的
        const match = results.find(m => (m.title == title || m.original_title == originalTitle)) || null;

        if (match) {
            // 新增：匹配成功日志
            console.log(`\x1b[32m[OK]\x1b[0m`); 
            return {
                id: match.id,
                type: "tmdb",
                title: match.title,
                description: match.overview || "",
                rating: match.vote_average,
                voteCount: match.vote_count,
                popularity: match.popularity,
                releaseDate: match.release_date || doubanItem.year,
                posterPath: match.poster_path ? match.poster_path : doubanItem.images.large,
                backdropPath: match.backdrop_path ? match.backdrop_path : doubanItem.images.large,
                mediaType: "movie",
                genreTitle: (match.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',')
            };
        } else {
            // 新增：匹配失败日志（告知是因为没搜到还是标题不符）
            const reason = results.length === 0 ? "TMDB无结果" : `标题不匹配(候选${results.length}个)`;
            console.log(`\x1b[33m[SKIP]\x1b[0m ${reason}`);
        }
    } catch (err) {
        console.log(`\x1b[31m[ERR]\x1b[0m ${err.message}`);
        log.warn(`跳过匹配失败条目 [${title}]: ${err.message}`);
    }

    return null; // 保持原逻辑：搜不到或不匹配就彻底不要了
}


async function fetchAndSync(endpoint) {
    let allSubjects = [];
    let start = 0;

    log.step(`同步分类: ${endpoint.toUpperCase()}`);

    while (true) {
        try {
            process.stdout.write(`   拉取豆瓣种子 [${start}]... \r`);
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
            log.error(`豆瓣列表中断: ${err.message}`);
            break;
        }
    }

    log.info(`种子获取完成，正在过滤并转换 TMDB 数据...`);
    
    const results = [];
    for (let i = 0; i < allSubjects.length; i++) {
        const item = allSubjects[i];
        const matched = await getStrictTMDBData(item);
        
        if (matched) {
            results.push(matched);
        }
        
        const percent = (((i + 1) / allSubjects.length) * 100).toFixed(0);
        process.stdout.write(`   进度: [${percent}%] 成功入库: ${results.length}\r`);
        
        await new Promise(r => setTimeout(r, MOVIE_DELAY));
    }
    process.stdout.write('\n');
    log.success(`${endpoint} 处理完毕，过滤掉 ${allSubjects.length - results.length} 个无法匹配的项目`);
    
    return results;
}

async function main() {
    const startTime = Date.now();
    log.info("🎬 启动 TMDB 纯净数据采集 (丢弃无匹配项)...");

    try {
        const finalResult = {
            updated_at: new Date().toISOString(),
            now_playing: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log.step(`任务完成!`);
        console.log(`--------------------------------------`);
        console.log(`📊 有效数据总量: ${finalResult.now_playing.length + finalResult.coming_soon.length + finalResult.top250.length}`);
        console.log(`📂 文件存放在: ${FILE_PATH}`);
        console.log(`⏱️ 耗时: ${duration}s`);
        console.log(`--------------------------------------`);

    } catch (mainErr) {
        log.error(`主流程崩溃: ${mainErr.stack}`);
    }
}

main();
