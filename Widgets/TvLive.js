var WidgetMetadata = {
  id: "tv_live",
  title: "电视台",
  description: "获取热门电视直播频道",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  version: "1.1.6",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "电视频道",
      description: "热门电视频道",
      requiresWebView: false,
      functionName: "getLiveTv",
      params: [
        {
          name: "sort_by",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "全部频道", value: "all" },
            { title: "央视频道", value: "cctv" },
            { title: "卫视频道", value: "stv" },
            { title: "地方频道", value: "ltv" }
          ]
        },
        {
          name: "url",
          title: "用户订阅",
          type: "input",
          description: "输入M3U格式订阅链接"
        },
        {
          name: "bg_color",
          title: "台标背景色",
          type: "input",
          description: "支持RGB颜色，如DCDCDC",
          placeholders: [
            { title: "水泥灰", value: "848484" },
            { title: "雾霾灰", value: "90A4AE" },
            { title: "暖灰色", value: "424242" },
            { title: "深灰色", value: "1C1C1E" }
          ]
        }
      ]
    }
  ]
};

async function getLiveTv(params = {}) {
  try {
    const response = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/data/iptv-data.json");
    
    if (!response?.data) {
      throw new Error("响应数据为空或格式不正确");
    }

    const modifiedData = { ...response.data };
    let addedSourcesCount = 0;
    const usedUserUrls = new Set();
    
    const url = params.url || "https://gist.githubusercontent.com/2kuai/d8e81b63e272dd838f372079bd204b42/raw/d9b79fe5937b0064ca0fe543dda78ba99787eb62/aptv";

    if (url) {
      try {
        const userResponse = await Widget.http.get(url);
        if (userResponse?.data) {
          const userChannels = parseM3U(userResponse.data);
          console.log(`[用户订阅] 从用户订阅中解析出 ${userChannels.length} 个频道`);
          
          const allPotentialMatches = [];
          
          for (const category in modifiedData) {
            if (Array.isArray(modifiedData[category])) {
              modifiedData[category].forEach(baseChannel => {
                userChannels.forEach(userChannel => {
                  if (!usedUserUrls.has(userChannel.url)) {
                    const score = calculateMatchScore(userChannel.name, baseChannel.name);
                    if (score > 0.7) {
                      allPotentialMatches.push({
                        baseChannel,
                        userChannel,
                        score
                      });
                    }
                  }
                });
              });
            }
          }
          
          allPotentialMatches.sort((a, b) => b.score - a.score);
          
          const channelStats = {};
          allPotentialMatches.forEach(({ baseChannel, userChannel }) => {
            if (!usedUserUrls.has(userChannel.url)) {
              const targetChannel = findChannelInData(modifiedData, baseChannel.name);
              if (targetChannel) {
                targetChannel.childItems = [
                  ...(targetChannel.childItems || []),
                  userChannel.url
                ].filter(Boolean);
                usedUserUrls.add(userChannel.url);
                addedSourcesCount++;
                
                if (!channelStats[baseChannel.name]) {
                  channelStats[baseChannel.name] = {
                    count: 0,
                    urls: []
                  };
                }
                channelStats[baseChannel.name].count++;
                channelStats[baseChannel.name].urls.push(userChannel.url);
              }
            }
          });
          
          console.log(`[用户订阅] 共添加了 ${addedSourcesCount} 个有效源`);
          for (const [channelName, stats] of Object.entries(channelStats)) {
            console.log(`  - ${channelName}: 添加了 ${stats.count} 个源`);
            stats.urls.forEach((url, index) => {
              console.log(`    ${index + 1}. ${url}`);
            });
          }
        }
      } catch (userError) {
        console.error("[用户订阅] 处理用户订阅失败:", userError.message);
      }
    }

    modifiedData["all"] = Object.values(modifiedData)
      .filter(Array.isArray)
      .flat();

    if (!params.sort_by || !modifiedData[params.sort_by]) {
      throw new Error(`不支持的类型: ${params.sort_by}`);
    }
    
    // 获取当前日期，格式为YYYY-MM-DD
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 获取频道列表
    const channels = modifiedData[params.sort_by];
    
    // 为每个频道获取EPG信息
    const channelsWithEPG = await Promise.all(channels.map(async (item) => {
      try {
        // 直接使用原始频道名称作为EPG查询参数
        const epgResponse = await Widget.http.get(`https://epg.aptv.app/?ch=${item.name}&date=${dateString}`, {
          headers: {
            "user-agent": "APTV/9.4.12 (com.kimen.aptvpro; build:1; iOS 18.6.2) Alamofire/5.9.1"
          }
        });
        
        if (epgResponse?.data) {
          // 解析EPG数据
          const epgInfo = parseEPGData(epgResponse.data);
          if (epgInfo) {
            // 合并原始描述和EPG信息
            const originalDesc = item.description || '';
            const epgDesc = formatEPGDescription(epgInfo);
            item.description = `${originalDesc}\n\n${epgDesc}`.trim();
          }
        }
      } catch (epgError) {
        console.error(`[EPG] 获取频道 ${item.name} 的EPG信息失败:`, epgError.message);
      }
      return item;
    }));
    
    return channelsWithEPG
      .map(item => {
        const validUrls = (item.childItems || [])
          .filter(url => typeof url === 'string' && url.trim());
        
        if (validUrls.length === 0) return null;

        const createItem = (url, title, isMain = false) => ({
          id: url,
          type: "url",
          title: isMain ? item.name : title,
          backdropPath: item.backdrop_path.replace(/bg-\w{6}/g, params.bg_color ? `bg-${params.bg_color}` : '$&'),
          description: item.description,
          videoUrl: url,
          customHeaders: {"user-agent": "AptvPlayer/1.4.10"}
        });

        const mainItem = createItem(validUrls[0], item.name, true);
        
        if (validUrls.length > 1) {
          mainItem.childItems = validUrls.slice(1).map((url, i) => 
            createItem(url, `${item.name} - (${i+1})`)
          );
        }
        
        return mainItem;
      })
      .filter(Boolean);
      
  } catch (error) {
    console.error("获取直播频道失败:", error.message);
    throw error;
  }
}

// 解析EPG数据
function parseEPGData(epgData) {
  try {
    if (!epgData || typeof epgData !== 'object' || !Array.isArray(epgData.epg_data)) {
      return null;
    }
    
    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 100 + currentMinute;
    
    // 查找当前正在播放的节目
    let currentProgram = null;
    // 查找所有即将播放的节目
    let upcomingPrograms = [];
    
    for (const program of epgData.epg_data) {
      if (!program.start || !program.end || !program.title) continue;
      
      const [startHour, startMinute] = program.start.split(':').map(Number);
      const [endHour, endMinute] = program.end.split(':').map(Number);
      const startTime = startHour * 100 + startMinute;
      const endTime = endHour * 100 + endMinute;
      
      if (currentTime >= startTime && currentTime < endTime) {
        currentProgram = {
          title: program.title,
          start: program.start,
          end: program.end,
          desc: program.desc || ''
        };
      } else if (currentTime < startTime) {
        upcomingPrograms.push({
          title: program.title,
          start: program.start,
          end: program.end,
          desc: program.desc || ''
        });
      }
    }
    
    return {
      current: currentProgram,
      upcoming: upcomingPrograms,
      date: epgData.date || '',
      channelName: epgData.channel_name || ''
    };
  } catch (error) {
    console.error("解析EPG数据失败:", error);
    return null;
  }
}

// 格式化EPG描述
function formatEPGDescription(epgInfo) {
  let desc = "【节目预告】\n";
  
  if (epgInfo.channelName) {
    desc += `频道: ${epgInfo.channelName}\n`;
  }
  if (epgInfo.date) {
    desc += `日期: ${epgInfo.date}\n`;
  }
  
  if (epgInfo.current) {
    desc += `正在播放: ${epgInfo.current.title} (${epgInfo.current.start}-${epgInfo.current.end})`;
    if (epgInfo.current.desc) {
      desc += `\n简介: ${epgInfo.current.desc}`;
    }
    desc += "\n";
  } else {
    desc += "当前无节目信息\n";
  }
  
  if (epgInfo.upcoming && epgInfo.upcoming.length > 0) {
    desc += "\n【即将播放】\n";
    epgInfo.upcoming.forEach((program, index) => {
      desc += `${index + 1}. ${program.title} (${program.start}-${program.end})`;
      if (program.desc) {
        desc += ` - ${program.desc}`;
      }
      desc += "\n";
    });
  } else {
    desc += "暂无后续节目信息";
  }
  
  return desc;
}

// 计算匹配分数
function calculateMatchScore(userName, baseName) {
  const normalize = (name) => {
    return (name || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/-/g, '')
      .replace(/[^\w\u4e00-\u9fa5]/g, '');
  };

  const userNorm = normalize(userName);
  const baseNorm = normalize(baseName);

  if (userNorm === baseNorm) return 1.0;

  const cctvPattern = /cctv(\d+)/;
  const userMatch = userNorm.match(cctvPattern);
  const baseMatch = baseNorm.match(cctvPattern);
  
  if (userMatch && baseMatch) {
    return userMatch[1] === baseMatch[1] ? 0.9 : 0;
  }

  return calculateSimilarity(userNorm, baseNorm);
}

// 计算字符串相似度
function calculateSimilarity(a, b) {
  const matrix = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

// 在数据中查找频道
function findChannelInData(data, channelName) {
  for (const category in data) {
    if (Array.isArray(data[category])) {
      const found = data[category].find(item => item.name === channelName);
      if (found) return found;
    }
  }
  return null;
}

// 解析M3U格式
function parseM3U(content) {
  const channels = [];
  let current = {};
  let lineIndex = 0;

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;

    if (line.includes(',http') && !line.startsWith('#')) {
      const [name, url] = line.split(',http');
      channels.push({
        name: name.trim(),
        url: 'http' + url.trim()
      });
      return;
    }

    if (line.startsWith('#EXTINF')) {
      current.name = line.match(/tvg-name="([^"]+)"/)?.[1] || 
                   line.match(/,([^,]+)$/)?.[1]?.trim() || '';
      lineIndex = 1;
    } else if (lineIndex === 1) {
      current.url = line;
      channels.push(current);
      current = {};
      lineIndex = 0;
    }
  });

  return channels;
}
