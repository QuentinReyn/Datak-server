class Alliance {
    constructor(name) {
      this.id = Math.random().toString(36).substr(2, 9); // Génère un ID unique
      this.name = name;
      this.attacks = [];
      this.players = [];
    }
  }
  module.exports = Alliance;