# sources/ —— 从网上抓来的词表放这儿

`tools/build-extra.js` 会读这个目录里 `<题材id>.txt` 的文件，把里面的词过滤后合并进页面的
“听得懂”层（family）。**这些词只会让游戏听懂更多说法，不会成为每天的答案。**

## 文件格式

一行一个词，可以带频次（会被忽略）：

```
淄博 120
天水 88
景德镇
```

- 只接受 2–4 个汉字，其余当作噪音丢掉
- 已经在本体词库里、或者属于别称表（如“过年”）的词会被跳过
- 每个题材默认最多加 40 个，用 `--limit` 改

## 直接给网址也行

新建 `urls.json`，键是题材 id，值是一个或多个 raw 文本地址：

```json
{
  "city": ["https://raw.githubusercontent.com/THUNLP/THUOCL/master/data/THUOCL_city.txt"],
  "food": ["https://raw.githubusercontent.com/THUNLP/THUOCL/master/data/THUOCL_food.txt"]
}
```

然后：

```bash
node tools/build-extra.js --fetch        # 先下载，再合并
node tools/build-extra.js --dry          # 只看会加什么
node tools/build-extra.js --limit 80     # 每个题材最多 80 个
```

生成物是项目根目录的 `extra-words.js`，`index.html` 已经引用了它；删掉这个文件就回到内置词库。
