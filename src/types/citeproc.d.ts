declare module "citeproc" {
  interface ProcessorSystem {
    retrieveLocale(language: string): string;
    retrieveItem(id: string): Record<string, unknown>;
  }

  const CSL: {
    Engine: new (
      system: ProcessorSystem,
      style: string,
      language?: string,
      forceLang?: boolean,
    ) => {
      updateItems(ids: string[]): void;
      setOutputFormat(format: "text" | "html"): void;
      makeBibliography(): [Record<string, unknown>, string[]] | false;
    };
  };
  export default CSL;
}
