var WidgetMetadata = {
    id: "tv_live",
    title: "电视台",
    description: "获取热门电视直播频道",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.1",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "电视频道",
            description: "热门电视频道",
            requiresWebView: false,
            functionName: "getLiveTv",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "全部", value: "all" },
                        { title: "央视", value: "cctv" },
                        { title: "卫视", value: "stv" },
                        { title: "地方", value: "ltv" }
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

        const allChannels = Object.values(modifiedData)
            .filter(channels => Array.isArray(channels))
            .flat();

        modifiedData["all"] = allChannels;

        if (!params.type || !modifiedData[params.type]) {
            throw new Error(`不支持的类型: ${params.type}`);
        }
        
        const dataType = modifiedData[params.type];
        
        const items = dataType.map((item) => {
            const childItems = (item.childItems || [])
                .filter(child => typeof child === 'string' && child.trim().length > 0)
                .map((child, index) => {
                    const urlId = child.match(/id=([^&]+)/)?.[1] || index + 1;
                    return {
                        id: child,
                        type: "url",
                        title: `备用线路 - ${index + 1}`,
                        backdropPath: item.backdrop_path,
                        description: item.description,
                        videoUrl: child
                    };
                });
                
            const baseItem = {
                id: item.id,
                type: "url",
                title: item.name,
                backdropPath: item.backdrop_path,
                description: item.description,
                videoUrl: item.id
            };
            
            if (childItems.length > 0) {
                baseItem.childItems = childItems;
            }
            
            return baseItem;
        });
        console.log("直播频道列表:", items);

        return items;
    } catch (error) {
        console.error("获取直播频道失败:", error.message);
        throw error;
    }
}