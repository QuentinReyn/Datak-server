class Player {
    constructor(pseudo) {
      this.id = Math.random().toString(36).substr(2, 9);
      this.pseudo = pseudo;
      this.attackId = null; // Par défaut, il n'est dans aucune attaque
      this.currentSocketId = null;   
    }
  }
  module.exports = Player;