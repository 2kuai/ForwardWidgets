import os
import asyncio
import aiohttp
import json
import time
import sys
from datetime import datetime

# --- 颜色常量 ---
BLUE = "\033[94m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

# --- 配置 ---
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
DATA_DIR = os.path.join(os.getcwd(), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'dbmovie-data.json')
CONCURRENCY_LIMIT = 5

REGIONS = [
    {"title": "全部", "limit": 300, "type": ""},
    {"title": "华语", "limit": 150, "type": "华语"},
    {"title": "欧美", "limit": 150, "type": "欧美"},
    {"title": "韩国", "limit": 150, "type": "韩国"},
    {"title": "日本", "limit": 150, "type": "日本"}
]

GENRE_MAP = {28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"}

tmdb_cache = {}
stats = {"total_douban": 0, "total_matched": 0, "start_time": 0}

class RateLimiter:
    def __init__(self, rate):
        self.rate = rate
        self.tokens = rate
        self.updated_at = time.monotonic()

    async def wait(self):
        while self.tokens < 1:
            now = time.monotonic()
            self.tokens += (now - self.updated_at) * self.rate
            self.updated_at = now
            if self.tokens < 1:
                await asyncio.sleep(0.1)
        self.tokens -= 1

limiter = RateLimiter(CONCURRENCY_LIMIT)

def log_progress(current, total, prefix=''):
    """打印实时进度条"""
    percent = (current / total) * 100
    bar = '█' * int(percent / 5) + '-' * (20 - int(percent / 5))
    sys.stdout.write(f'\r   {prefix} |{bar}| {percent:.1f}% ({current}/{total})')
    sys.stdout.flush()

async def fetch_tmdb_detail(session, title):
    if not title: return None
    if title in tmdb_cache: return tmdb_cache[title]

    await limiter.wait()
    url = "https://api.themoviedb.org/3/search/movie"
    params = {"api_key": TMDB_API_KEY, "query": title, "language": "zh-CN"}
    
    try:
        async with session.get(url, params=params, timeout=10) as resp:
            if resp.status == 429:
                return await fetch_tmdb_detail(session, title)
            if resp.status == 200:
                data = await resp.json()
                results = data.get("results", [])
                if results:
                    m = results[0]
                    res = {
                        "id": str(m.get("id")),
                        "title": m.get("title"),
                        "description": m.get("overview"),
                        "posterPath": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else None,
                        "rating": m.get("vote_average"),
                        "releaseDate": m.get("release_date"),
                        "genreTitle": ", ".join([GENRE_MAP.get(gid, "") for gid in m.get("genre_ids", []) if GENRE_MAP.get(gid)])
                    }
                    tmdb_cache[title] = res
                    return res
    except: pass
    return None

async def process_region(session, region):
    print(f"\n{BOLD}{BLUE}▶ 正在抓取区域: {region['title']}{RESET}")
    douban_url = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"
    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Referer": "https://m.douban.com/movie/"}
    params = {"start": 0, "limit": region['limit'], "type": region['type'], "score_range": "6,10"}

    try:
        async with session.get(douban_url, params=params, headers=headers, timeout=15) as resp:
            data = await resp.json()
            items = data.get("items", [])
            count = len(items)
            stats["total_douban"] += count
            
            if not items:
                print(f"   {YELLOW}⚠ 该区域未返回数据，跳过。{RESET}")
                return region['title'], []

            print(f"   已从豆瓣获取 {count} 条目，开始匹配 TMDB...")
            
            matched_results = []
            done = 0
            # 这里的并发获取
            tasks = [fetch_tmdb_detail(session, item.get('title')) for item in items]
            for coro in asyncio.as_completed(tasks):
                res = await coro
                done += 1
                if res: matched_results.append(res)
                log_progress(done, count, prefix='匹配中')
            
            print(f"\n   {GREEN}✅ {region['title']} 匹配完成: {len(matched_results)}/{count}{RESET}")
            stats["total_matched"] += len(matched_results)
            return region['title'], matched_results
    except Exception as e:
        print(f"\n   {RED}❌ {region['title']} 发生异常: {str(e)}{RESET}")
        return region['title'], []

async def main():
    stats["start_time"] = time.time()
    print(f"{BOLD}{GREEN}=== 豆瓣电影数据同步任务开始 ==={RESET}")
    print(f"{BLUE}[INFO]{RESET} 运行时环境: GitHub Actions / Python {sys.version.split()[0]}")
    print(f"{BLUE}[INFO]{RESET} 目标目录: {DATA_DIR}")

    if not TMDB_API_KEY:
        print(f"{RED}[FATAL]{RESET} 错误: 环境变量 TMDB_API_KEY 未设置")
        sys.exit(1)

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"{BLUE}[INFO]{RESET} 已创建数据目录")

    async with aiohttp.ClientSession() as session:
        final_data = {}
        for region in REGIONS:
            name, data = await process_region(session, region)
            final_data[name] = data
            await asyncio.sleep(1.5)

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

    duration = time.time() - stats["start_time"]
    print(f"\n{BOLD}{GREEN}=== 任务执行总结 ==={RESET}")
    print(f"   总耗时: {duration:.1f} 秒")
    print(f"   豆瓣总条目: {stats['total_douban']}")
    print(f"   TMDB 成功匹配: {stats['total_matched']}")
    print(f"   匹配率: {(stats['total_matched']/stats['total_douban']*100 if stats['total_douban']>0 else 0):.1f}%")
    print(f"   数据已保存至: {BOLD}{OUTPUT_FILE}{RESET}")
    print(f"{BOLD}{GREEN}============================{RESET}")

if __name__ == "__main__":
    asyncio.run(main())
