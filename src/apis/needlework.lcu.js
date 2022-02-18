import fs from "fs";
import path from "path";
import WebSocket from "ws";
const axios = require("axios");
const https = require("https");
const exec = require("child_process").execSync;
const { app } = require("electron");

const WS_OPCODES = Object.freeze({
  WELCOME: 0,
  PREFIX: 1,
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
  SUBSCRIBE: 5,
  UNSUBSCRIBE: 6,
  PUBLISH: 7,
  EVENT: 8,
});

export default class NeedleworkLCU {
  constructor() {
    this.clientHTTPS = new LeagueClientHTTPS();
    // this.clientWS = new LeagueClientWebSocket();
  }

  get currentSummoner() {
    return this.clientHTTPS.fetch("/lol-summoner/v1/current-summoner");
  }

  get wallet() {
    return this.clientHTTPS.fetch("/lol-store/v1/wallet");
  }

  get playerLootMap() {
    return this.clientHTTPS.fetch("/lol-loot/v1/player-loot-map");
  }
}

class LeagueClientAuth {
  static _instance = null;

  constructor() {
    if (LeagueClientAuth._instance) {
      return LeagueClientAuth._instance;
    }

    const _data = this.parseForWindows();

    this.auth = _data.auth;
    this.port = _data.port;
    this.token = _data.token;

    this.agent = this.createAgent();

    LeagueClientAuth._instance = this;
  }

  isClientActive() {
    try {
      const cmd =
        "wmic PROCESS WHERE name='LeagueClientUx.exe' GET commandline";
      const stdout = exec(cmd);

      return !!stdout;
    } catch (error) {
      console.error(error);
    }
  }

  refreshAuth() {
    const _data = this.parseForWindows();

    this.auth = _data.auth;
    this.port = _data.port;
    this.token = _data.token;
  }

  parseForWindows() {
    try {
      const cmd =
        "wmic PROCESS WHERE name='LeagueClientUx.exe' GET commandline";
      const portRe = /(?<=--app-port=)([0-9]*)/g;
      const tokenRe = /(?<=--remoting-auth-token=)([\w-]*)/g;

      const stdout = exec(cmd);

      let _data = {};
      _data.port = portRe.exec(stdout)[0];
      _data.token = tokenRe.exec(stdout)[0];
      // Encode token for Riot Basic Authentication
      _data.auth = Buffer.from("riot:" + _data.token).toString("base64");

      NeedleworkConsole.log("Established authentication!");
      NeedleworkConsole.log(_data);

      return _data;
    } catch (error) {
      console.error(error);
    }
  }

  createAgent() {
    const paths = {
      data: app.getPath("userData"),
      dir: path.join(app.getPath("userData"), "data"),
      cert: path.join(app.getPath("userData"), "data", "riotgames.pem"),
    };
    const agent = (path) => {
      return new https.Agent({ ca: fs.readFileSync(path) });
    };

    try {
      if (!fs.existsSync(paths.dir)) {
        fs.mkdirSync(paths.dir);
      }

      // Check if cached certificate is missing
      if (!fs.existsSync(paths.cert)) {
        // Get certificate
        const certificateURL =
          "https://static.developer.riotgames.com/docs/lol/riotgames.pem";
        const wfile = fs.createWriteStream(paths.cert);
        const request = https.get(certificateURL, (response) => {
          response.pipe(wfile);
        });

        wfile.on("finish", () => {
          return agent(paths.cert);
        });
      } else {
        return agent(paths.cert);
      }
    } catch (error) {
      console.error(error);
    }
  }
}

class LeagueClientHTTPS {
  constructor() {
    this.leagueClientAuth = new LeagueClientAuth();
    this.https = axios;
    this.instance = this.createInstance();
  }

  createInstance() {
    return this.https.create({
      baseURL: "https://127.0.0.1:" + this.leagueClientAuth.port,
      timeout: 1000,
      headers: { authorization: "Basic " + this.leagueClientAuth.auth },
      httpsAgent: this.leagueClientAuth.agent,
    });
  }

  async fetch(api) {
    try {
      const response = await this.instance.get(api);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }
}

class LeagueClientWebSocket {
  constructor() {
    this.leagueClientAuth = new LeagueClientAuth();
    this.OPCODES = WS_OPCODES;
    this.ws = this.setupWebSocket();

    this.ws.addListener("open", () => {
      NeedleworkConsole.log("WebSocket opened! :3");
      this.subscribe("/lol-store/v1/wallet", NeedleworkConsole.log);
    });

    this.ws.addListener("close", () => {
      NeedleworkConsole.log("WebSocket closed! :<");
      this.unsubscribe("/lol-store/v1/wallet", NeedleworkConsole.log);
    });
  }

  setupWebSocket() {
    const password = this.leagueClientAuth.token;
    const port = this.leagueClientAuth.port;
    const agent = this.leagueClientAuth.agent;
    const wsURL = `wss://riot:${password}@127.0.0.1:${port}/`;

    const ws = new WebSocket(wsURL, "wamp", {
      agent: agent,
    });

    return ws;
  }

  subscribe(topic, func) {
    this.ws.addListener(topic, func);
    this.ws.send(JSON.stringify[(this.OPCODES.SUBSCRIBE, topic)]);
  }

  unsubscribe(topic, func) {
    this.ws.removeListener(topic, func);
    this.ws.send(JSON.stringify[(this.OPCODES.UNSUBSCRIBE, topic)]);
  }
}

class NeedleworkConsole {
  static signature = "Needlework: ";
  static log(args) {
    if (args instanceof Object) {
      console.log(NeedleworkConsole.signature, args);
    } else {
      console.log(NeedleworkConsole.signature + args);
    }
  }
}
