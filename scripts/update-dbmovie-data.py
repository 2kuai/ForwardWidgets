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
CYAN = "\033[96m"
RESET = "\033[0m"

# --- 配置 ---
TMDB_API_KEY = os.environ.get('TMDB_API_KEY') # 对应你的 v4 Bearer Token
DATA_DIR = os.path.join(os.getcwd(), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'dbmovie-data.json')
CONCURRENCY_LIMIT = 5 # 每秒请求数限制

REGIONS = [
    {"title": "全部", "limit": 300, "type": ""},
    {"title": "华语", "limit": 150, "type": "华语"},
    {"title": "欧美", "limit": 150, "type": "欧美"},
    {"title": "韩国", "limit": 150, "type": "韩国"},
    {"title": "日本", "limit": 150, "type": "日本"}
]

GENRE_MAP = {28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"}

tmdb_cache = {}
stats = {"total_douban": 0, "total_matched": 0, "fail_tmdb_null": 0, "fail_api_error": 0}

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

async def fetch_tmdb_detail(session, title):
    if not title: return None, "豆瓣标题为空"
    if title in tmdb_cache: return tmdb_cache[title], "命中本地缓存"

    await limiter.wait()
    url = "https://api.themoviedb.org/3/search/movie"
    
    # 使用 Bearer Token 验证
    headers = {
        "Authorization": f"Bearer {TMDB_API_KEY}",
        "Content-Type": "application/json;charset=utf-8"
    }
    params = {"query": title, "language": "zh-CN"}
    
    try:
        async with session.get(url, params=params, headers=headers, timeout=10) as resp:
            if resp.status == 429:
                await asyncio.sleep(2)
                return await fetch_tmdb_detail(session, title)
            
            if resp.status != 200:
                stats["fail_api_error"] += 1
                return None, f"TMDB接口错误(Status:{resp.status})"
            
            data = await resp.json()
            results = data.get("results", [])
            if not results:
                stats["fail_tmdb_null"] += 1
                return None, "TMDB未搜到结果"
            
            m = results[0]
            res = {
                "id": str(m.get("id")),
                "type": "tmdb",
                "title": m.get("title"),
                "description": m.get("overview"),
                "posterPath": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else None,
                "backdropPath": f"https://image.tmdb.org/t/p/w500{m.get('backdrop_path')}" if m.get('backdrop_path') else None,
                "rating": m.get("vote_average"),
                "releaseDate": m.get("release_date"),
                "genreTitle": ", ".join([GENRE_MAP.get(gid, "") for gid in m.get("genre_ids", []) if GENRE_MAP.get(gid)])
            }
            tmdb_cache[title] = res
            return res, "成功返回TMDB数据"
    except Exception as e:
        stats["fail_api_error"] += 1
        return None, f"请求异常: {str(e)}"

async def process_region(session, region):
    print(f"\n{BOLD}{BLUE}▶ 正在同步区域: {region['title']} ({region['limit']}条){RESET}")
    douban_url = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"
    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Referer": "https://m.douban.com/movie/"}
    params = {"start": 0, "limit": region['limit'], "type": region['type'], "score_range": "6,10"}

    try:
        async with session.get(douban_url, params=params, headers=headers, timeout=15) as resp:
            if resp.status != 200:
                print(f"   {RED}❌ 豆瓣接口请求失败 (Status: {resp.status}){RESET}")
                return region['title'], []
            
            data = await resp.json()
            items = data.get("items", [])
            if not items:
                print(f"   {YELLOW}⚠ 豆瓣未返回任何条目{RESET}")
                return region['title'], []

            stats["total_douban"] += len(items)
            print(f"   已获取豆瓣列表，开始检索详情...\n")
            
            matched_results = []
            # 并发执行
            tasks = [fetch_tmdb_detail(session, item.get('title')) for item in items]
            
            # 实时滚动日志
            done = 0
            for i, coro in enumerate(asyncio.as_completed(tasks)):
                res, reason = await coro
                done += 1
                movie_title = items[i-1].get('title', '未知')
                
                if res:
                    matched_results.append(res)
                    print(f"   [{done}/{len(items)}] {GREEN}成功{RESET} | 豆瓣: {CYAN}{movie_title[:10]}{RESET} -> TMDB: {res['title'][:10]}")
                else:
                    print(f"   [{done}/{len(items)}] {RED}失败{RESET} | 豆瓣: {CYAN}{movie_title[:10]}{RESET} 原因: {YELLOW}{reason}{RESET}")
            
            stats["total_matched"] += len(matched_results)
            print(f"\n   {GREEN}✅ {region['title']} 完成: 匹配成功 {len(matched_results)}/{len(items)}{RESET}")
            return region['title'], matched_results
    except Exception as e:
        print(f"   {RED}❌ 区域处理异常: {str(e)}{RESET}")
        return region['title'], []

async def main():
    start_time = time.time()
    print(f"{BOLD}{GREEN}=== 豆瓣电影 -> TMDB 异步同步工具 (Header Auth) ==={RESET}")

    if not TMDB_API_KEY:
        print(f"{RED}[FATAL]{RESET} 未检测到 TMDB_API_KEY 环境变量！")
        return

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    async with aiohttp.ClientSession() as session:
        final_data = {}
        for region in REGIONS:
            name, data = await process_region(session, region)
            final_data[name] = data
            await asyncio.sleep(1.5)

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            
    duration = time.time() - start_time
    print(f"\n{BOLD}{GREEN}=== 最终执行总结 ==={RESET}")
    print(f"   总耗时: {duration:.1f}s")
    print(f"   豆瓣抓取总数: {stats['total_douban']}")
    print(f"   TMDB成功匹配: {stats['total_matched']}")
    print(f"   TMDB未检索到: {stats['fail_tmdb_null']}")
    print(f"   API接口异常: {stats['fail_api_error']}")
    print(f"   成功率: {(stats['total_matched']/stats['total_douban']*100 if stats['total_douban']>0 else 0):.1f}%")
    print(f"{BOLD}{GREEN}=============================================={RESET}")

if __name__ == "__main__":
    asyncio.run(main())
