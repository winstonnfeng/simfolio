export class SearchInstruments {
  constructor({ marketData }) {
    this.marketData = marketData;
  }

  execute({ query }) {
    return this.marketData.searchInstruments(String(query ?? ''));
  }

  listPopular() {
    return this.marketData.listPopular();
  }
}
