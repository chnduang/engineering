const fs = require("fs");
const path = require("path");
const process = require("process");

const ignoreList = [".DS_Store"];
const ignoreSiderList = [".vuepress", ".DS_Store", "README.md", "temp"];

const workPath = path.join(process.cwd() + "/docs");

function getSiderChildren(parentName) {
  const currentPath = path.join(workPath + `/${parentName}`);
  const filterFiles = fs
    .readdirSync(currentPath)
    .filter((file) => !ignoreList.includes(file));
  const files = filterFiles.map((file) => {
    if (file === "README.md") {
      return `/${parentName}/`;
    }
    if (file.endsWith(".md")) {
      const fileName = file.split(".")[0];
      return `/${parentName}/${fileName}`;
    }
    let currentFile = { title: file };
    const subPath = `${currentPath}/${file}`;
    if (fs.statSync(subPath).isDirectory()) {
      return {
        ...currentFile,
        children: getSiderChildren(`${parentName}/${file}`),
      };
    }
  });
  return files.filter((item) => item);
}

const getSortList = (parentName) => {
  const list = getSiderChildren(parentName);
  return [...new Set([`/${parentName}/`, ...list])];
};

const getSiderList = () => {
  let siderObj = {};
  const siderFiles = fs
    .readdirSync(workPath)
    .filter((file) => !ignoreSiderList.includes(file));
  for (let val of siderFiles) {
    siderObj = {
      ...siderObj,
      [`/${val}/`]: getSortList(val),
    };
  }
  return siderObj;
};

const sidebar = getSiderList();

const getBaiduTongji = () => {
  return `
  var _hmt = _hmt || [];
  (function() {
    var hm = document.createElement("script");
    hm.src = "https://hm.baidu.com/hm.js?0088ce24040b03f2947322ab31d23414";
    var s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(hm, s);
  })();
  `;
};

const getBaiduSpa = () => {
  return `
  var _hmt = _hmt || [];
  _hmt.push(['_requirePlugin', 'UrlChangeTracker', {
    shouldTrackUrlChange: function (newPath, oldPath) {
      newPath = newPath.split('#')[0];
      oldPath = oldPath.split('#')[0];
      return newPath != oldPath;
    }}
  ]);
  `;
};

const baiduTongji = getBaiduTongji();
const baiduSpa = getBaiduSpa();
const base = "/";

const nav = [
  { text: "工程化", link: "/engineering/" },
  { text: "Webpack", link: "/webpack/" },
  { text: "深入浅出Webpack", link: "/webpack-explain/" },
  {
    text: "Babel",
    link: "/babel/",
  },
  {
    text: "微前端",
    link: "/micro-front/",
  },
  { text: "Home", link: "https://link.qdzhou.cn" },
];

module.exports = {
  title: "duangdong的engineering",
  description: "前端相关知识归纳总结",
  base,
  host: "localhost",
  port: 9209,
  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
    ["link", { rel: "manifest", href: "/manifest.json" }],
    [
      "meta",
      {
        name: "keywords",
        content: "qd-blog,node,vuepress,leetcode,algorithm",
      },
    ],
    ["script", {}, baiduTongji],
    ["script", {}, baiduSpa],
  ],
  plugins: [
    ["@vuepress/medium-zoom", true],
    ["@vuepress/back-to-top", true],
    ["vuepress-plugin-code-copy", true],
    [
      "@vuepress/pwa",
      {
        serviceWorker: true,
        updatePopup: true,
      },
    ],
    [
      "vuepress-plugin-right-anchor",
      {
        showDepth: 3,
        ignore: ["/", "/api/"],
        expand: {
          trigger: "click",
          clickModeDefaultOpen: true,
        },
        customClass: "your-customClass",
        disableGlobalUI: false,
      },
    ],
  ],
  themeConfig: {
    sidebarDepth: 0,
    searchMaxSuggestions: 10,
    lastUpdated: "上次更新",
    editLinks: true,
    smoothScroll: true,
    nav,
    sidebar,
  },
};
