<p align="center">
  <br>
  <img width="150" src="./icon.png">
  <br>
  <br>
</p>

<div align=center>
    
[**简体中文 🇨🇳**](README.md) / [**English 🇺🇸**](README_EN.md)

</div>

# ForwardWidget

ForwardWidget 是一个用于构建模块的 JS 组件，提供了丰富的网页相关功能和数据模型。

## 开发自定义 Widget

ForwardWidget 支持通过 JavaScript 脚本扩展功能。每个 Widget 都是一个独立的 JavaScript 文件，需要遵循特定的结构和规范。

### Widget 元数据配置

每个 Widget 脚本必须以 `WidgetMetadata` 对象开始，定义 Widget 的基本信息和功能模块：

```javascript
var WidgetMetadata = {
    id: "unique_id",           // Widget 唯一标识符
    title: "Widget Title",     // Widget 显示标题
    description: "Description", // Widget 描述
    author: "Author Name",     // 作者
    site: "https://example.com", // 网站地址
    version: "1.0.0",         // Widget 版本
    requiredVersion: "0.0.1",  // 所需 ForwardWidget 版本
    modules: [                 // 功能模块列表
        {
            title: "Module Title",     // 模块标题
            description: "Description", // 模块描述
            requiresWebView: false,    // 是否需要 WebView
            functionName: "functionName", // 处理函数名
            sectionMode: false,        // 是否支持分段模式
            params: [                  // 参数配置
                {
                    name: "paramName",     // 参数名
                    title: "Param Title",  // 参数显示标题
                    type: "input",         // 参数类型 input | constant | enumeration | count | page
                    description: "Description", // 参数描述
                    value: "defaultValue", // 默认值
                    belongTo: { // 当符合该条件时才会触发该参数
                        paramName: "param name" // 所属参数的子参数
                        value: ["value"] // 所属参数包含的值
                    }
                    placeholders: [        // 占位符选项
                        {
                            title: "Option Title",
                            value: "optionValue"
                        }
                    ],
                    enumOptions: [         // 枚举选项
                        {
                            title: "Option Title",
                            value: "optionValue"
                        }
                    ]
                }
            ]
        }
    ],
    search: {                   // 搜索功能配置（可选）
        title: "Search",
        requiresWebView: false,
        functionName: "search",
        params: [/* 搜索参数配置 */]
    }
};
```

### 参数类型说明

Widget 支持以下参数类型：

- `input`: 文本输入框
- `count`: 数字计数器
- `constant`: 常量值
- `enumeration`: 枚举选择器
- `page`: 页码选择器

### 处理函数规范

每个模块都需要实现对应的处理函数，函数名与 `functionName` 一致。处理函数接收一个 `params` 对象作为参数，包含所有配置的参数值。

```javascript
async function functionName(params = {}) {
    try {
        // 1. 参数验证
        if (!params.requiredParam) {
            throw new Error("缺少必要参数");
        }

        // 2. 发送请求
        const response = await Widget.http.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 ...",
                "Referer": "https://example.com"
            }
        });

        // 3. 解析响应
        const docId = Widget.dom.parse(response.data);
        const elements = Widget.dom.select(docId, "selector");

        // 4. 返回结果
        return elements.map(element => ({
            id: "unique_id",
            type: "type",
            title: "title",
            coverUrl: "url",
            // ... 其他属性
        }));
    } catch (error) {
        console.error("处理失败:", error);
        throw error;
    }
}
```

### DOM 操作 API

Widget 提供了以下 DOM 操作 API：

```javascript
// 解析 HTML
const docId = Widget.dom.parse(htmlString);

// 选择元素
const elements = Widget.dom.select(docId, "selector");

// 选择第一个元素
const element = Widget.dom.selectFirst(docId, "selector");

// 获取元素文本
const text = Widget.dom.text(elementId);

// 获取元素属性
const value = Widget.dom.attr(elementId, "attributeName");
```

### HTTP 请求 API

Widget 提供了 HTTP 请求 API：

```javascript
// GET 请求
const response = await Widget.http.get(url, {
    headers: {
        "User-Agent": "Mozilla/5.0 ...",
        "Referer": "https://example.com"
    }
});

// POST 请求
const response = await Widget.http.post(url, {
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
});

let data = response.data
```

### 返回数据格式

处理函数需要返回符合 ForwardWidget 数据模型的对象数组：

```javascript
// 视频列表项
{
    id: "unique_id",           // 根据不同类型的主要值，type 为 url 时，为对应 url，type 为 douban、imdb 时，id 为对应 id 值
    type: "type",             // 类型标识 url, douban, imdb
    title: "title",           // 标题
    coverUrl: "url",          // 封面图片地址
    durationText: "00:00",    // 时长文本
    previewUrl: "url",        // 预览视频地址
    description: "description" // 描述
}

// 分段数据
{
    title: "Section Title",   // 分段标题
    items: [/* 视频列表项数组 */]
}
```

### 最佳实践

1. **错误处理**
   - 使用 try-catch 捕获异常
   - 提供有意义的错误信息
   - 在控制台输出调试信息

2. **参数验证**
   - 验证必要参数是否存在
   - 验证参数值是否有效
   - 提供默认值处理

3. **性能优化**
   - 使用适当的请求头
   - 缓存重复使用的数据
   - 优化 DOM 选择器

4. **代码组织**
   - 使用清晰的函数命名
   - 添加必要的注释
   - 模块化处理逻辑

### 调试

App 内置了模块测试工具

1. 使用 `console.log()` 输出调试信息
2. 检查网络请求和响应
3. 验证 DOM 解析结果
4. 测试不同参数组合
