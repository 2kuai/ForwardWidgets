import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 环境初始化 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'dbmovie-data.json');

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
};

const REGIONS = [
    { title: "全部", limit: 300 },
    { title: "华语", limit: 150 },
    { title: "欧美", limit: 150 },
    { title: "韩国", limit: 150 },
    { title: "日本", limit: 150 }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 核心逻辑 ---

async function fetchWithRetry(title, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
                params: { api_key: TMDB_API_KEY, query: title, language: 'zh-CN' },
                timeout: 10000
            });
            const matched = res.data.results?.[0];
            if (!matched) return null;

            return {
                id: matched.id.toString(),
                type: "tmdb",
                title: matched.title,
                description: matched.overview,
                posterPath: matched.poster_path ? `https://image.tmdb.org/t/p/w500${matched.poster_path}` : null,
                backdropPath: matched.backdrop_path ? `https://image.tmdb.org/t/p/w500${matched.backdrop_path}` : null,
                rating: matched.vote_average,
                releaseDate: matched.release_date,
                genreTitle: (matched.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(', ')
            };
        } catch (err) {
            let waitTime = Math.pow(2, i + 1);
            if (err.response?.status === 429) {
                const retryAfter = parseInt(err.response.headers['retry-after']);
                waitTime = retryAfter ? retryAfter + 1 : waitTime;
            }
            if (i === maxRetries - 1) return null;
            await sleep(waitTime * 1000);
        }
    }
}

async function main() {
    console.log(`\x1b[35m[START]\x1b[0m 开始同步豆瓣电影数据 (ESM 模式)`);
    if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY is missing");

    await fs.mkdir(DATA_DIR, { recursive: true });

    let finalData = {};
    for (const region of REGIONS) {
        console.log(`\n\x1b[36m▶ 正在处理: ${region.title}\x1b[0m`);
        try {
            const res = await axios.get(`https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie`, {
                params: { start: 0, limit: region.limit, type: region.title, score_range: "6,10" },
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": "https://movie.douban.com/"
                }
            });

            const items = res.data.items || [];
            const results = [];
            // 使用串行+微延迟保护 API
            for (let i = 0; i < items.length; i++) {
                const detail = await fetchWithRetry(items[i].title);
                if (detail) results.push(detail);
                if ((i + 1) % 50 === 0) console.log(`   进度: ${i + 1}/${items.length}`);
                await sleep(150);
            }
            finalData[region.title] = results;
            console.log(`\x1b[32m✅ ${region.title} 完成，匹配成功: ${results.length}\x1b[0m`);
        } catch (e) {
            console.error(`\x1b[31m❌ ${region.title} 失败: ${e.message}\x1b[0m`);
        }
        await sleep(2000);
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`\n\x1b[32m🎉 数据已写入: ${OUTPUT_FILE}\x1b[0m`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
