class Attack {
    constructor(name, location, allianceId, ownerId) {
      this.id = Math.random().toString(36).substr(2, 9);
      this.name = name;
      this.location = location;
      this.creationDate = new Date();
      this.duration = null; // Par défaut 60 min
      this.status = "pending"; // "pending", "in-progress", "finished"
      this.allianceId = allianceId;
      this.players = [];
      this.ownerId = ownerId;
    }
  }
  module.exports = Attack;