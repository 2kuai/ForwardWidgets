const fs = require('fs');
const path = require('path');
const axios = require('axios');

// --- 配置 ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const DATA_DIR = './data';
const OUTPUT_FILE = path.join(DATA_DIR, 'dbmovie-data.json');
const CONCURRENCY = 8; // 最大并发请求数

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

const C = {
    cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', magenta: '\x1b[35m', dim: '\x1b[2m',
    reset: '\x1b[0m', bright: '\x1b[1m'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 增强型请求函数 (带重试逻辑) ---
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
                posterPath: matched.poster_path,
                backdropPath: matched.backdrop_path,
                rating: matched.vote_average,
                releaseDate: matched.release_date,
                genreTitle: (matched.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).join(', ')
            };
        } catch (err) {
            const status = err.response?.status;
            // 默认退避时间: 2s, 4s, 8s...
            let waitTime = Math.pow(2, i + 1); 

            // 如果触发 TMDB 的频率限制 (429)
            if (status === 429) {
                const retryAfter = parseInt(err.response.headers['retry-after']);
                waitTime = retryAfter ? retryAfter + 1 : waitTime;
                console.log(`${C.yellow}[RATE LIMIT]${C.reset} 触发限制，等待 ${waitTime}s 后重试 [${title}]`);
            } else if (i < maxRetries - 1) {
                console.log(`${C.dim}[RETRY]${C.reset} 请求失败 (${status || 'TIMEOUT'})，${waitTime}s 后进行第 ${i+1} 次重试...`);
            } else {
                return null; // 最终失败
            }
            await sleep(waitTime * 1000);
        }
    }
}

// --- 并发控制池 ---
async function concurrentProcess(items, limit) {
    const results = [];
    const queue = [...items];
    let count = 0;

    async function worker() {
        while (queue.length > 0) {
            const item = queue.shift();
            const detail = await fetchWithRetry(item.title);
            if (detail) results.push(detail);
            
            count++;
            if (count % 20 === 0 || count === items.length) {
                console.log(`${C.dim}[PROGRESS]${C.reset} 已处理: ${count}/${items.length}`);
            }
        }
    }

    const pool = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(pool);
    return results;
}

// --- 主程序 ---
async function main() {
    console.log(`\n${C.magenta}${C.bright}>>> 启动智能重试爬虫系统 <<<${C.reset}\n`);

    if (!TMDB_API_KEY) {
        console.error(`${C.red}错误: 环境变量 TMDB_API_KEY 未设置${C.reset}`);
        process.exit(1);
    }

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    const finalData = {};

    for (const region of REGIONS) {
        console.log(`\n${C.cyan}${C.bright}▶ 区域任务: ${region.title} (限额 ${region.limit})${C.reset}`);
        
        try {
            const res = await axios.get(`https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie`, {
                params: { start: 0, limit: region.limit, type: region.title, score_range: "6,10" },
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
                    "Referer": "https://movie.douban.com/"
                }
            });

            const dbItems = res.data.items || [];
            console.log(`${C.dim}[INFO] 豆瓣获取成功，开始 TMDB 并发匹配...${C.reset}`);

            const matchedResults = await concurrentProcess(dbItems, CONCURRENCY);
            finalData[region.title] = matchedResults;

            console.log(`${C.green}✅ ${region.title} 完成: 成功 ${matchedResults.length} / 总计 ${dbItems.length}${C.reset}`);
        } catch (err) {
            console.error(`${C.red}❌ ${region.title} 区域抓取中断: ${err.message}${C.reset}`);
        }
        
        await sleep(2000); // 区域切换防封缓冲
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`\n${C.green}${C.bright}🎉 任务圆满完成！数据已同步至: ${OUTPUT_FILE}${C.reset}\n`);
}

main();
