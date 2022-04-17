import fs from "fs";
import fetch from "node-fetch";
import lodash from "lodash";
import Format from "./Format.js";
import Character from "./models/Character.js";
import Reliquaries from "./models/Reliquaries.js";

const _path = process.cwd();
const cfgPath = `${_path}/plugins/miao-plugin/config.js`;
let config = {};
//try {
if (fs.existsSync(cfgPath)) {
  let fileData = await import (`file://${cfgPath}`);
  if (fileData && fileData.config) {
    config = fileData.config;
  }
}
//} catch (e) {
// do nth
//}

const userPath = `${_path}/data/UserData/`;

if (!fs.existsSync(userPath)) {
  fs.mkdirSync(userPath);
}

const artifactMap = {
  '生命值': {
    title: "小生命"
  },
  '生命值_百分比': {
    title: "大生命",
    pct: true
  },
  '暴击率': {
    title: "暴击率",
    pct: true
  },
  '暴击伤害': {
    title: "暴击伤害",
    pct: true
  },
  '防御力': {
    title: "小防御"
  },
  '防御力_百分比': {
    title: "大防御",
    pct: true
  },
  '攻击力': {
    title: "小攻击"
  },
  '攻击力_百分比': {
    title: "大攻击",
    pct: true
  },
  '元素精通': {
    title: "元素精通"
  },
  '元素充能效率': {
    title: "充能效率",
    pct: true
  },
  '治疗加成': {
    title: "治疗加成",
    pct: true
  }
}


let Data = {
  getData(uid, data) {
    let ret = {
      uid,
      chars: {}
    };

    lodash.forEach({
      name: "角色名称",
      avatar: "头像ID",
      lv: "冒险等阶"
    }, (title, key) => {
      ret[key] = data[title] || "";
    })

    lodash.forEach(data.items, (ds) => {
      let char = Data.getAvatar(ds);
      ret.chars[char.id] = char;
    });

    return ret;

  },
  getAvatar(data) {
    let char = Character.get(data["英雄Id"]);
    return {
      id: data["英雄Id"],
      name: char ? char.name : "",
      lv: data['等级'],
      attr: Data.getAttr(data),
      // weapon: Data.getWeapon(data),
      artis: Data.getArtifact(data),
      //cons: data["命之座数量"] * 1 || 0,
      //talent: Data.getTalent(data)
    };
  },
  getAttr(data) {
    let ret = {};
    let attrKey = {
      atk: "攻击力_总",
      atkBase: "属性攻击力",
      def: "防御力_总",
      defBase: "属性防御力",
      hp: "生命值上限_总",
      hpBase: "属性生命值上限",
      mastery: "属性元素精通",
      cRate: {
        title: "属性暴击率",
        pct: true
      },
      cDmg: {
        title: "属性暴击伤害",
        pct: true
      },
      hInc: {
        title: "属性治疗加成",
        pct: true
      },
      recharge: {
        title: "属性元素充能效率",
        pct: true
      }
    };
    lodash.forEach(attrKey, (cfg, key) => {
      if (typeof (cfg) === "string") {
        cfg = { title: cfg };
      }
      let val = data[cfg.title] || "";
      if (cfg.pct) {
        val = (val * 100).toFixed(2)
      }
      ret[key] = val;
    });
    let maxDmg = 0;
    lodash.forEach("火水草雷风冰岩".split(""), (key) => {
      maxDmg = Math.max(data[`属性${key}元素伤害加成`] * 1, maxDmg);
    });
    ret.dmgBonus = (maxDmg * 100).toFixed(2);
    ret.phyBonus = (data[`属性物理伤害加成`] * 100).toFixed(2);

    return ret;
  },
  getWeapon(data) {
    return {
      name: data['武器名称'],
      lv: data['武器等级'],
      refine: data["武器精炼"]
    }
  },
  getArtifact(data) {
    let ret = {};
    let get = function (idx, key) {
      let v = data[`圣遗物${idx}${key}`];
      let ret = /^([^\d]*)([\d\.\-]*)$/.exec(v);
      if (ret && ret[1]) {
        let title = ret[1], val = ret[2];
        if (artifactMap[title]) {
          if (artifactMap[title].pct) {
            val = (val * 100).toFixed(2);
          }
          title = artifactMap[title].title;
        }
        return [title, val];
      }
      return [];
    }

    for (let idx = 1; idx <= 5; idx++) {
      ret[`arti${idx}`] = {
        name: data[`圣遗物${idx}名称`],
        type: data[`圣遗物${idx}类型`],
        main: get(idx, "主词条"),
        attrs: [
          get(idx, "副词条1"),
          get(idx, "副词条2"),
          get(idx, "副词条3"),
          get(idx, "副词条4"),
        ]
      };
    }
    return ret;
  },
  getTalent(data) {
    let ret = {};
    lodash.forEach({
      a: 1,
      e: 2,
      q: 3
    }, (idx, key) => {
      let val = data[`天赋主动名称${idx}`]
      let regRet = /等级(\d*)$/.exec(val);
      if (regRet && regRet[1]) {
        ret[key] = regRet[1] * 1 || 1
      } else {
        ret[key] = 1;
      }
    })
    return ret;
  }
}

let Profile = {
  async request(uid, e) {
    let cfg = config.miaoApi || {};
    if (!cfg.api) {
      e.reply("尚未配置更新Api，无法更新数据~");
      return false;
    }
    if (!cfg.qq || !cfg.token || cfg.token.length !== 32) {
      e.reply("Token错误，无法请求数据~");
      return false;
    }
    e.reply("开始获取角色展柜中展示的角色详情，请确认已经打开显示角色详情开关，数据获取可能会需要一定时间~");
    const api = `${cfg.api}?uid=${uid}&qq=${cfg.qq}&token=${cfg.token}`;
    console.log(api);
    let req = await fetch(api);
    let data = await req.json();
    //fs.writeFileSync(userPath + "/test.json", data);
    if (data.status !== 0 || !data.data) {
      e.reply(`请求错误:${data.msg || "未知错误"}`);
      return false;
    }
    data = data.data;

    let userData = {};
    if (data && data["角色名称"]) {
      userData = Profile.save(uid, data)
    }
    return userData;
  },

  save(uid, ds) {
    let userData = {};
    const userFile = `${userPath}/${uid}.json`;
    if (fs.existsSync(userFile)) {
      userData = JSON.parse(fs.readFileSync(userFile, "utf8")) || {};
    }
    let data = Data.getData(uid, ds);
    lodash.assignIn(userData, lodash.pick(data, "uid,name,lv,avatar".split(",")));
    userData.chars = userData.chars || {};
    lodash.forEach(data.chars, (char, charId) => {
      userData.chars[charId] = char;
    });
    fs.writeFileSync(userFile, JSON.stringify(userData), "", " ");
    return data;
  },
  get(uid, charId) {
    const userFile = `${userPath}/${uid}.json`;
    let userData = {};
    if (fs.existsSync(userFile)) {
      userData = JSON.parse(fs.readFileSync(userFile, "utf8")) || {};
    }
    if (userData && userData.chars && userData.chars[charId]) {
      return userData.chars[charId];
    }
    return false;
  },
  formatArti(ds) {
    if (lodash.isArray(ds[0])) {
      let ret = [];
      lodash.forEach(ds, (d) => {
        ret.push(Profile.formatArti(d));
      })
      return ret;
    }
    let title = ds[0], val = ds[1];
    if (!title || title === "undefined") {
      return [];
    }
    if (/伤害加成/.test(title) && val < 1) {
      val = Format.pct(val * 100);
    } else if (/伤害加成|大|暴|充能|治疗/.test(title)) {
      val = Format.pct(val);
    } else {
      val = Format.comma(val, 1);
    }


    if (/元素伤害加成/.test(title)) {
      title = title.replace("元素伤害", "伤");
    } else if (title === "物理伤害加成") {
      title = "物伤加成";
    }
    return [title, val];
  },
  getArtiMark(data, ds) {
    Reliquaries.getMark(data)
    let total = 0;
    lodash.forEach(data, (ret) => {
      if (ret[0] && ret[1]) {
        total += mark[ret[0]] * ret[1];
      }
    })
    if (ds && /暴/.test(ds[0])) {
      total += 20;
    }
    return total;
  }
};
export default Profile;
