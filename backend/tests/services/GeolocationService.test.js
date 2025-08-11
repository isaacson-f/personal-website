const GeolocationService = require('../../services/GeolocationService');

describe('GeolocationService', () => {
  it('should work', () => {
    const service = new GeolocationService();
    expect(service.isPrivateIP('127.0.0.1')).toBe(true);
  });
});