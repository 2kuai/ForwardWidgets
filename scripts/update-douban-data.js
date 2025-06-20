import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../data/douban-data.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search';

// 豆瓣本周榜单类型
const WEEKLY_TYPES = [
  { key: 'movie_weekly_best', title: '一周口碑电影榜', mediaType: 'movie' },
  { key: 'tv_chinese_best_weekly', title: '华语口碑剧集榜', mediaType: 'tv' },
  { key: 'tv_global_best_weekly', title: '全球口碑剧集榜', mediaType: 'tv' },
  { key: 'show_chinese_best_weekly', title: '国内口碑综艺榜', mediaType: 'tv' },
  { key: 'show_global_best_weekly', title: '国外口碑综艺榜', mediaType: 'tv' }
];

// 年度榜单 id 及子分类
const ANNUAL_IDS = [
  { id: '478', title: '评分最高华语电影', mediaType: 'movie' },
  { id: '528', title: '评分最高外语电影', mediaType: 'movie' },
  { id: '529', title: '年度冷门佳片', mediaType: 'movie' },
  { id: '545', title: '评分最高华语剧集', mediaType: 'tv' },
  { id: '547', title: '评分最高英美新剧', mediaType: 'tv' },
  { id: '546', title: '评分最高英美续订剧', mediaType: 'tv' },
  { id: '559', title: '最值得期待华语电影', mediaType: 'movie' },
  { id: '560', title: '最值得期待外语电影', mediaType: 'movie' },
  { id: '561', title: '最值得期待剧集', mediaType: 'tv' },
  { id: '563', title: '地区&类型电影', mediaType: 'movie', sub_ids: [
    { sub_id: '16065', title: '评分最高日本电影' },
    { sub_id: '16066', title: '评分最高韩国电影' },
    { sub_id: '16067', title: '评分最高喜剧片' },
    { sub_id: '16068', title: '评分最高爱情片' },
    { sub_id: '16069', title: '评分最高恐怖片' },
    { sub_id: '16070', title: '评分最高动画片' },
    { sub_id: '16071', title: '评分最高纪录片' }
  ]},
  { id: '565', title: '上映周年电影', mediaType: 'movie', sub_ids: [
    { sub_id: '16080', title: '上映10周年电影' },
    { sub_id: '16081', title: '上映20周年电影' },
    { sub_id: '16082', title: '上映30周年电影' },
    { sub_id: '16083', title: '上映40周年电影' },
    { sub_id: '16084', title: '上映50周年电影' }
  ]}
];

async function fetchWeeklyList(typeKey) {
  const url = `https://m.douban.com/rexxar/api/v2/subject_collection/${typeKey}/items?updated_at&items_only=1&type_tag&for_mobile=1`;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'referer': `https://m.douban.com/subject_collection/${typeKey}/`
      },
      timeout: 10000
    });
    if (!response.data?.subject_collection_items?.length) {
      console.warn(`[${typeKey}] 无返回数据`);
      return [];
    }
    return response.data.subject_collection_items.map(item =>
      `${item.title}${item.year ? `（${item.year}）` : ''}`
    );
  } catch (error) {
    console.error(`[${typeKey}] 获取榜单失败: ${error.message}`);
    return [];
  }
}

async function fetchAnnualList(id, sub_id) {
  const url = 'https://movie.douban.com/j/neu/page/27/';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://movie.douban.com/annual/2024/?fullscreen=1&dt_from=movie_navigation'
      },
      timeout: 10000
    });
    const widgets = response.data.widgets || [];
    const matched = widgets.find(widget => String(widget.id) === String(id));
    if (!matched?.source_data) {
      console.warn(`[${id}${sub_id ? ':' + sub_id : ''}] 未找到对应榜单数据`);
      return [];
    }
    const sourceData = matched.source_data;
    if (Array.isArray(sourceData) && sub_id) {
      const matchedGroup = sourceData.find(group => String(group.subject_collection?.id) === String(sub_id));
      if (!matchedGroup?.subject_collection_items?.length) {
        console.warn(`[${id}:${sub_id}] 未找到匹配的子榜单数据`);
        return [];
      }
      return matchedGroup.subject_collection_items.map(item =>
        `${item.title}${item.year ? `（${item.year}）` : ''}`
      );
    }
    if (!sourceData.subject_collection_items?.length) {
      console.warn(`[${id}] 榜单数据为空`);
      return [];
    }
    return sourceData.subject_collection_items.map(item =>
      `${item.title}${item.year ? `（${item.year}）` : ''}`
    );
  } catch (error) {
    console.error(`[${id}${sub_id ? ':' + sub_id : ''}] 获取年度榜单失败: ${error.message}`);
    return [];
  }
}

console.log(sourceData);

async function searchTMDB(title, mediaType, year) {
  try {
    const cleanedName = title.replace(/（\d{4}）$/, '').trim();;
    const url = mediaType === 'movie'
      ? `${TMDB_BASE_URL}/search/movie`
      : `${TMDB_BASE_URL}/search/tv`;
    const params = {
      query: cleanedName,
      language: 'zh-CN'
    };
    if (year) {
      if (mediaType === 'movie') params.year = year;
      if (mediaType === 'tv') params.first_air_date_year = year;
    }
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${TMDB_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    const data = response.data;
    if (data.results && data.results.length > 0) {
      const bestMatch = data.results[0];
      return {
        id: bestMatch.id,
        type: 'tmdb',
        title: mediaType === 'movie' ? bestMatch.title : bestMatch.name,
        description: bestMatch.overview,
        posterPath: bestMatch.poster_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` 
          : null,
        backdropPath: bestMatch.backdrop_path 
          ? `https://image.tmdb.org/t/p/w500${bestMatch.backdrop_path}` 
          : null,
        releaseDate: mediaType === 'movie' ? bestMatch.release_date : bestMatch.first_air_date,
        rating: bestMatch.vote_average,
        mediaType: mediaType
      };
    }
    return null;
  } catch (error) {
    console.error(`[TMDB] 搜索失败 "${title}": ${error.message}`);
    return null;
  }
}

function needTMDBFill(obj, fields) {
  return fields.some(f => !obj[f] || obj[f] === '' || obj[f] === undefined);
}

async function fillWithTMDB(list, mediaType) {
  for (const item of list) {
    const year = (item.releaseDate || '').match(/\d{4}/)?.[0];
    if (!item.tmdb) {
      const tmdb = await searchTMDB(item.title, mediaType, year);
      if (tmdb) {
        item.tmdb = tmdb;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return list;
}

async function main() {
  const result = {
    last_updated: new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('Z', '+08:00'),
    weekly: {},
    annual: {}
  };
  // weekly
  for (const { key, title, mediaType } of WEEKLY_TYPES) {
    console.log(`正在获取: ${title} (${key}) ...`);
    let list = await fetchWeeklyList(key);
    if (TMDB_API_KEY) list = await fillWithTMDB(list, mediaType);
    result.weekly[key] = list;
    await new Promise(r => setTimeout(r, 500));
  }
  // annual
  for (const annual of ANNUAL_IDS) {
    if (annual.sub_ids) {
      for (const sub of annual.sub_ids) {
        console.log(`正在获取: ${annual.title} - ${sub.title} (${annual.id}:${sub.sub_id}) ...`);
        let data = await fetchAnnualList(annual.id, sub.sub_id);
        if (TMDB_API_KEY) data = await fillWithTMDB(data, annual.mediaType);
        if (!result.annual[annual.id]) result.annual[annual.id] = {};
        result.annual[annual.id][sub.sub_id] = data;
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      console.log(`正在获取: ${annual.title} (${annual.id}) ...`);
      let data = await fetchAnnualList(annual.id);
      if (TMDB_API_KEY) data = await fillWithTMDB(data, annual.mediaType);
      result.annual[annual.id] = data;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  const dataDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`数据已保存至: ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error('脚本执行出错:', error);
  process.exit(1);
}); 
