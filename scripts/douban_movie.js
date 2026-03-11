const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DOUBAN_API_KEY = "0ac44ae016490db2204ce0a042db2916"; // 使用你提供的 Key
const BASE_URL = "https://api.douban.com/v2/movie";

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部"
};

const MAX_COUNT = 100; // 豆瓣单次请求上限
const REQUEST_TIMEOUT = 15000;
const MOVIE_DELAY = 100;

const dir = './data';
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const FILE_PATH = path.join(dir, 'douban_movie_data.json');

// ================= 核心逻辑 =================

/**
 * 匹配 TMDB 数据 (逻辑同前)
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
        const exactMatch = results.find(m => (m.title === title || m.original_title === originalTitle)) || (results.length > 0 ? results[0] : null);

        if (exactMatch) {
            const genreTitle = (exactMatch.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',') || doubanItem.genres.join(',');
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
    } catch (err) { /* 忽略 TMDB 错误 */ }

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
 * 智能同步逻辑：
 * 1. 热映/即将上映：直接 count=100 单次拉取
 * 2. Top 250：执行循环分页
 */
async function fetchAndSync(endpoint) {
    let allSubjects = [];
    let start = 0;
    const isTop250 = endpoint === 'top250';

    console.log(`\n🚀 开始处理分类: ${endpoint}`);

    while (true) {
        try {
            console.log(`   [请求] start=${start}, count=${MAX_COUNT}`);
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

            // 如果不是 Top 250，或者已经拿到了所有数据，就退出循环
            if (!isTop250 || allSubjects.length >= (res.data.total || 250)) {
                break;
            }

            start += MAX_COUNT;
            await new Promise(r => setTimeout(r, 500)); // 分页微调
        } catch (err) {
            console.error(`   ❌ 分页请求异常: ${err.message}`);
            break;
        }
    }

    console.log(`   [处理] 开始匹配 TMDB 数据 (${allSubjects.length} 条)...`);
    const results = [];
    for (const item of allSubjects) {
        results.push(await getAccurateMovieData(item));
        await new Promise(r => setTimeout(r, MOVIE_DELAY));
    }
    return results;
}

async function main() {
    const startTime = Date.now();
    try {
        const finalResult = {
            in_theaters: await fetchAndSync('in_theaters'),
            coming_soon: await fetchAndSync('coming_soon'),
            top250: await fetchAndSync('top250')
        };

        fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
        console.log(`\n🏁 任务完成! 耗时: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    } catch (mainErr) {
        console.error(`❌ 主流程失败: ${mainErr.message}`);
    }
}

main();
