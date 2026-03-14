const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const TMDB_API_KEY = process.env.TMDB_API_KEY; 
const RANK_API = "https://api.bilibili.com/pgc/web/rank/list";
const DATA_DIR = './data';
const FILE_PATH = path.join(DATA_DIR, 'bilibili_animation_data.json');

const CATEGORIES = [
    { key: 'anime', type: 1, label: '番剧 (Anime)' },
    { key: 'donghua', type: 4, label: '国创 (Donghua)' }
];

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录", 18: "剧情",
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑",
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部",
    10759: "动作冒险", 10762: "儿童", 10765: "科幻奇幻"
};

const log = {
    info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
    success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
    warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
    error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
    step: (msg) => console.log(`\n\x1b[35m===> ${msg}\x1b[0m`)
};

// ================= 工具逻辑 =================

function cleanTitle(title) {
    return title
        .replace(/（仅限.*）/g, '')
        .replace(/\(仅限.*\)/g, '')
        .replace(/第[一二三四五六七八九十\d]+季/g, '')
        .replace(/：.*/g, '')
        .replace(/中配版|日语版|国语版/g, '')
        .trim();
}

async function getTMDBData(biliItem) {
    const rawTitle = biliItem.title;
    const searchQuery = cleanTitle(rawTitle);

    try {
        process.stdout.write(`   🔍 匹配中: <${rawTitle.slice(0, 12)}>... `);

        const res = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
            params: { query: searchQuery, language: 'zh-CN', include_adult: false },
            headers: { 'Authorization': `Bearer ${TMDB_API_KEY}` },
            timeout: 15000
        });

        const results = res.data.results || [];
        const match = results.find(m => m.media_type === 'tv' || m.media_type === 'movie');

        if (match) {
            process.stdout.write(`\x1b[32m[OK]\x1b[0m\n`);
            return {
                id: match.id,
                type: "tmdb",
                title: match.name || match.title,
                description: match.overview || "",
                rating: match.vote_average,
                vote_count: match.vote_count || 0,
                popularity: match.popularity || 0,
                releaseDate: match.first_air_date || match.release_date || "",
                posterPath: match.poster_path || "", // 不要前缀
                backdropPath: match.backdrop_path || "", // 不要前缀
                mediaType: match.media_type,
                genreTitle: (match.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(',') || "动画"
            };
        }
        process.stdout.write(`\x1b[33m[SKIP]\x1b[0m\n`);
    } catch (err) {
        process.stdout.write(`\x1b[31m[ERR]\x1b[0m ${err.message}\n`);
    }
    return null;
}

// ================= 主程序 =================

async function main() {
    const startTime = Date.now();
    log.info("🎬 启动 Bilibili 动画排行榜同步 (数据格式对齐版)...");

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    const finalResult = {
        updated_at: new Date().toISOString(),
        anime: [],
        donghua: []
    };

    for (const cat of CATEGORIES) {
        log.step(`正在处理分类: ${cat.label}`);
        try {
            const res = await axios.get(RANK_API, {
                params: { day: 3, season_type: cat.type },
                headers: { 'Referer': 'https://www.bilibili.com/' }
            });

            const list = (res.data.result.list || []);
            for (let i = 0; i < list.length; i++) {
                const matched = await getTMDBData(list[i]);
                if (matched) finalResult[cat.key].push(matched);
                
                const percent = (((i + 1) / list.length) * 100).toFixed(0);
                process.stdout.write(`   进度: [${percent}%] 成功入库: ${finalResult[cat.key].length}\r`);
                await new Promise(r => setTimeout(r, 200));
            }
            process.stdout.write('\n');
        } catch (e) {
            log.error(`分类异常: ${e.message}`);
        }
    }

    fs.writeFileSync(FILE_PATH, JSON.stringify(finalResult, null, 2), 'utf-8');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.step(`同步完成！`);
    console.log(`--------------------------------------`);
    console.log(`📊 数据汇总: Anime(${finalResult.anime.length}) / Donghua(${finalResult.donghua.length})`);
    console.log(`⏱️ 总耗时: ${duration}s`);
    console.log(`--------------------------------------`);
}

main();
