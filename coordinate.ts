import { roundAndTruncate } from '../lib/lib';
import mgrs from 'mgrs';

export type CoordinateFormat = 'D.D' | 'D M.M' | 'D M S.S' | 'MGRS';

export class Coordinate {
  latitude: number;
  longitude: number;
  // To know how a coordinate was created if passed in a string, otherwise it is
  // not detected
  detected: CoordinateFormat | 'Not Detected';

  // Create a coordinate by latitude and longitude
  constructor(latitude: number, longitude: number);

  // Create a coordinate from a string
  constructor(coordinate: string);

  constructor(latOrString: number | string, longitude?: number) {
    // If passed a lat and lng as a number, create a new coordinate. It sets
    // the detected to Not Detected. Detected is for user input strings.
    if (typeof latOrString !== 'string' && typeof longitude === 'number') {
      this.latitude = latOrString;
      this.longitude = longitude;
      this.detected = 'Not Detected';
      return;
    }
    if (typeof latOrString !== 'string')
      throw new Error(`Pass a string or (latitude, longitude), passed ${latOrString}`);
    const coordinate = latOrString;

    // Check if the coordinate is MGRS, of so, handle it.
    // Of note, if a 10 digit grid is passed, converted to lat/lng, then back to
    // MGRS it can be off by the 5th digit (1 meter).
    const mgrsRegex = /^[0-9]+[a-zA-Z]\s*[a-zA-Z]+\s*([0-9]\s*[0-9]\s*)+$/;
    if (mgrsRegex.test(coordinate)) {
      // Remove spaces
      let string = coordinate.replace(/\s/g, '');

      // Add missing zeros - needed for mgrs library
      const numbersArray = string.match(/([0-9]\s*[0-9]\s*)+$/);
      if (numbersArray && numbersArray.length > 0) {
        const stringLength = string.length;
        const mgrsLength = numbersArray[0].length / 2;
        for (let i = mgrsLength; i < 5; i++) {
          string = string.slice(0, stringLength - mgrsLength) + '0' + string.slice(stringLength - mgrsLength) + '0';
        }
      }

      const [lon, lat] = mgrs.toPoint(string);
      this.latitude = lat;
      this.longitude = lon;
      this.detected = 'MGRS';
      return;
    }

    // This intentionally takes almsot any format of coordinate. It errs to guessing over
    // wanting perfectly formatted coordinates. It searches for W or E in the string and
    // looks at the number of digits grouped together.
    const containsWest = coordinate.match(/[wW]+/) ? true : false;
    const containesSouth = coordinate.match(/[sS]+/) ? true : false;
    const parts = coordinate.match(/-?[0-9.]+/g);
    if (!parts) throw new Error('Not valid coordinates');
    const numbers = parts.map((part) => parseFloat(part));

    // The user must be passing in D.D with only two sets of numbers
    if (numbers.length === 2) {
      this.latitude = numbers[0];
      this.longitude = numbers[1];
      if (containesSouth && this.latitude > 0) this.latitude = this.latitude * -1;
      if (containsWest && this.longitude > 0) this.longitude = this.longitude * -1;
      this.detected = 'D.D';

      // The user is passing in D M.M
    } else if (numbers.length === 4) {
      if (numbers[1] < 0 || numbers[3] < 0) throw new Error('Not valid coordinates');
      this.latitude = Math.abs(numbers[0]) + numbers[1] / 60;
      this.longitude = Math.abs(numbers[2]) + numbers[3] / 60;
      if (containesSouth && numbers[0] > 0) this.latitude = this.latitude * -1;
      if (containsWest && numbers[2] > 0) this.longitude = this.longitude * -1;
      this.detected = 'D M.M';

      // The user is passing in D M S.S
    } else if (numbers.length === 6) {
      if (numbers[1] < 0 || numbers[2] < 0 || numbers[4] < 0 || numbers[5] < 0)
        throw new Error('Not valid coordinates');
      this.latitude = Math.abs(numbers[0]) + numbers[1] / 60 + numbers[2] / 60 / 60;
      this.longitude = Math.abs(numbers[3]) + numbers[4] / 60 + numbers[5] / 60 / 60;
      if (containesSouth && numbers[0] > 0) this.latitude = this.latitude * -1;
      if (containsWest && numbers[3] > 0) this.longitude = this.longitude * -1;
      this.detected = 'D M S.S';
    } else {
      throw new Error('Not valid coordinates');
    }

    if (this.latitude > 90 || this.latitude < -90 || this.longitude > 180 || this.longitude < -180)
      throw new Error('Not valid coordinates');
  }

  // Helpful if the format the user wants is stored in the preferences
  toFormat(format: CoordinateFormat): string {
    switch (format) {
      case 'D.D':
        return this.degreesDecimalDegrees;
      case 'D M.M':
        return this.degreesMinutesDecimalMinutes;
      case 'D M S.S':
        return this.degreesMinutesSecondsDecimalSeconds;
      case 'MGRS':
        let string = mgrs.forward([this.longitude, this.latitude]);
        string = string.slice(0, 3) + ' ' + string.slice(3, 5) + ' ' + string.slice(5, 10) + ' ' + string.slice(10);
        return string;
    }
  }

  // Returns N 34.54 W 113.24
  get degreesDecimalDegrees() {
    const latDeg = Math.abs(this.latitude);
    const lngDeg = Math.abs(this.longitude);
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitude < 0) latHemisphere = 'S';
    if (this.longitude < 0) lngHemisphere = 'W';

    return `${latHemisphere} ${roundAndTruncate(latDeg, 6)} ` + `${lngHemisphere} ${roundAndTruncate(lngDeg, 6)}`;
  }

  // Returns N 34 50.2 W 116 32.4
  get degreesMinutesDecimalMinutes() {
    const latDegFloor = Math.floor(Math.abs(this.latitude));
    const latMin = latDegFloor === 0 ? this.latitude * 60 : (Math.abs(this.latitude) % latDegFloor) * 60;
    const lngDegFloor = Math.floor(Math.abs(this.longitude));
    const lngMin = lngDegFloor === 0 ? this.longitude * 60 : (Math.abs(this.longitude) % lngDegFloor) * 60;
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitude < 0) {
      latHemisphere = 'S';
    }
    if (this.longitude < 0) {
      lngHemisphere = 'W';
    }
    return (
      `${latHemisphere} ${latDegFloor} ${roundAndTruncate(latMin, 4, 2)} ` +
      `${lngHemisphere} ${lngDegFloor} ${roundAndTruncate(lngMin, 4, 2)}`
    );
  }

  // Returns N 39 50 24.23 W 115 34 23.9
  get degreesMinutesSecondsDecimalSeconds() {
    const latDegFloor = Math.floor(Math.abs(this.latitude));
    const latMin = latDegFloor === 0 ? this.latitude * 60 : (Math.abs(this.latitude) % latDegFloor) * 60;
    const latMinFloor = Math.floor(latMin);
    const latSec = latMinFloor === 0 ? latMinFloor * 60 : (latMin % latMinFloor) * 60;

    const lngDegFloor = Math.floor(Math.abs(this.longitude));
    const lngMin = lngDegFloor === 0 ? this.longitude * 60 : (Math.abs(this.longitude) % lngDegFloor) * 60;
    const lngMinFloor = Math.floor(lngMin);
    const lngSec = lngMinFloor === 0 ? lngMinFloor * 60 : (lngMin % lngMinFloor) * 60;
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitude < 0) {
      latHemisphere = 'S';
    }
    if (this.longitude < 0) {
      lngHemisphere = 'W';
    }
    return (
      `${latHemisphere} ${latDegFloor} ${roundAndTruncate(latMinFloor, 2, 2)} ${roundAndTruncate(latSec, 2, 2)} ` +
      `${lngHemisphere} ${lngDegFloor} ${roundAndTruncate(lngMinFloor, 2, 2)} ${roundAndTruncate(lngSec, 2, 2)}`
    );
  }
}

export default Coordinate;
