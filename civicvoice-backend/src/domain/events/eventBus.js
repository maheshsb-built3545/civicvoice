/**
 * eventBus.js
 * -----------------------------------------------------------------------
 * Minimal internal event bus using Node's EventEmitter.
 * Events emitted:
 *  - 'complaint.created'
 *  - 'complaint.assigned'
 *  - 'complaint.status_changed'
 */

const EventEmitter = require('events');

class AppEventBus extends EventEmitter {}

const eventBus = new AppEventBus();

module.exports = eventBus;
