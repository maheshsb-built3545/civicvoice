/**
 * channel.interface.js
 * -----------------------------------------------------------------------
 * Shared contract for messaging channel adapters.
 * Every channel adapter (WhatsApp, SMS, Telegram, Voice) must implement:
 *   - receiveWebhook(req) -> Promise<InternalMessage | InternalMessage[]>
 *   - sendMessage(recipientId, payload) -> Promise<object>
 */

class ChannelInterface {
  /**
   * @param {object} req - Express request object
   * @returns {Promise<object | object[]>} Normalized InternalMessage(s)
   */
  async receiveWebhook(req) {
    throw new Error('receiveWebhook() must be implemented by channel adapter');
  }

  /**
   * @param {string} recipientId
   * @param {string|object} payload
   * @returns {Promise<object>}
   */
  async sendMessage(recipientId, payload) {
    throw new Error('sendMessage() must be implemented by channel adapter');
  }
}

module.exports = ChannelInterface;
