import BaseModule from "../BaseModule";
import pt from "./lang/pt.json";
import manifest from "./manifest.json";

export default class extends BaseModule {
  constructor() {
    manifest.translations = { pt };
    super(manifest);
  }

  onInstall() {
    console.log(`${this.manifest.name} installed successfully`);
  }
}
