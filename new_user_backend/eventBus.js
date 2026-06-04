const EventEmitter = require('events');

class EventBus extends EventEmitter {}

// Singleton event bus instance
const eventBus = new EventBus();

module.exports = eventBus;
