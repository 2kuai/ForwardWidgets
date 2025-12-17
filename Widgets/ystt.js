WidgetMetadata = {
  id: "ystt.vod",
  title: "影视天堂",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  description: "影视天堂内容",
  author: "两块",
  site: "https://github.com/InchStudio/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: []
    }
  ],
};

WidgetMetadata = {
  id: "ystt.vod",
  title: "影视天堂",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "影视天堂资源模块",
  author: "Forward",
  site: "https://github.com/InchStudio/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: [],
    }
  ],
};

async function loadResource(params) {
  const { seriesName, type, episode } = params;
  
  try { 
    const searchName = seriesName || "浪浪山小妖怪";
    const encodedName = encodeURIComponent(searchName);
    const testUrl = `https://ysttv.com/search/index/type/1/keyword/${encodedName}/page/1`;
    
    console.log(`搜索: "${searchName}"`);
    
    const response = await Widget.http.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
        'Referer': 'https://ysttv.com/'
      }
    });
    
    if (!response?.data) {
      console.log("搜索失败");
      return [];
    }
    
    const $ = Widget.html.load(response.data);
    let exactMatch = null;
    
    // 解析搜索结果
    $('main ul.grid.grid-cols-1.gap-4 > li').each((_, element) => {
        const li$ = $(element);
        const link = li$.find('a').attr('href');
        if (!link) return;
        
        const href = link.trim();
        const titleElement = li$.find('h2.response-title');
        const name = titleElement.text()?.trim() || li$.find('a').attr('title') || '';
        
        // 判断类型
        const infoDiv = li$.find('div.my-0\\.5, div.my-1');
        const infoText = infoDiv.text();
        let mediaType = infoText.includes('电影') ? 'movie' : 'tv';
        
        // 提取ID
        const idMatch = href.match(/\/detail\/(\d+)/);
        const vod_id = idMatch ? idMatch[1] : href;
        
        console.log(`结果: ${name} (${mediaType})`);
        
        // 精确匹配检查
        const searchNameLower = searchName.toLowerCase();
        const itemNameLower = name.toLowerCase();
        
        if (itemNameLower.includes(searchNameLower)) {
            console.log(`匹配: ${name}`);
            
            if (!type || type === mediaType) {
                // 构建播放页面URL
                let playPageUrl;
                if (mediaType === 'movie') {
                    playPageUrl = `http://ysttv.com/player/${vod_id}/${encodedName}`;
                } else {
                    playPageUrl = `https://ysttv.com/player/${vod_id}/${episode || 1}`;
                }
                
                exactMatch = {
                    playPageUrl: playPageUrl,
                    mediaType: mediaType
                };
                return false; // 停止遍历
            }
        }
    });
    
    // 如果有精确匹配，获取播放链接
    if (exactMatch) {
        console.log(`获取播放链接: ${exactMatch.playPageUrl}`);
        return await getPlayUrls(exactMatch.playPageUrl);
    }
    
    console.log(`没有匹配`);
    return [];
    
  } catch (error) {
    console.error("错误:", error);
    return [];
  }
}

// 获取播放链接
async function getPlayUrls(playPageUrl) {
  try {
    console.log(`解析播放页面: ${playPageUrl}`);
    
    const response = await Widget.http.get(playPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
        'Referer': 'https://ysttv.com/'
      }
    });
    
    if (!response?.data) {
      console.log("页面加载失败");
      return [];
    }
    
    const $ = Widget.html.load(response.data);
    
    // 直接使用你提供的脚本中的选择器
    const playUrl = $('#mse').attr('data-url');
    
    if (playUrl) {
      console.log(`找到播放链接: ${playUrl.substring(0, 80)}...`);
      return [
        {
          name: "影视天堂",
          description: "", 
          url: playUrl
        }
      ];
    } else {
      console.log("未找到播放链接: #mse 元素不存在或没有 data-url 属性");
      // 调试：输出页面前200个字符，查看实际HTML结构
      const htmlPreview = response.data.substring(0, 200);
      console.log(`HTML预览: ${htmlPreview}...`);
      return [];
    }
    
  } catch (error) {
    console.error("解析播放链接错误:", error);
    return [];
  }
}