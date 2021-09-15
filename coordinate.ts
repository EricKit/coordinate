import { roundAndTruncate } from '../lib/lib';
import mgrs from '../projects/mgrs/dist/mgrs';

export type CoordinateFormat = 'D.D' | 'D M.M' | 'D M S.S' | 'MGRS';

export class Coordinate {
  latitudeDecimal: number;
  longitudeDecimal: number;
  latitudeWhole: number;
  longitudeWhole: number;
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
      if (latOrString > 90 || latOrString < -90 || longitude > 180 || longitude < -180)
        throw new Error('Not valid coordinates');
      this.latitudeWhole = Math.floor(Math.abs(latOrString));
      this.longitudeWhole = Math.floor(Math.abs(longitude));
      this.latitudeDecimal = latOrString % 1;
      this.longitudeDecimal = longitude % 1;
      if (latOrString < 0) this.latitudeWhole *= -1;
      if (longitude < 0) this.longitudeWhole *= -1;
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

      const [lng, lat] = mgrs.toPoint(string);
      this.latitudeWhole = Math.floor(Math.abs(lat));
      this.longitudeWhole = Math.floor(Math.abs(lng));
      this.latitudeDecimal = lat % 1;
      this.longitudeDecimal = lng % 1;
      if (lat < 0 && this.latitudeWhole > 0) this.latitudeWhole = this.latitudeWhole * -1;
      if (lng < 0 && this.longitudeWhole > 0) this.longitudeWhole = this.longitudeWhole * -1;
      if (this.latitudeWhole < 0 && this.longitudeWhole > 0) this.longitudeWhole = this.longitudeWhole * -1;
      if (this.longitudeWhole < 0 && this.longitudeDecimal > 0) this.longitudeDecimal = this.longitudeDecimal * -1;
      this.detected = 'MGRS';
      return;
    }

    // This intentionally takes almsot any format of coordinate. It errs to guessing over
    // wanting perfectly formatted coordinates. It searches for W or E in the string and
    // looks at the number of digits grouped together.
    const containsWest = coordinate.match(/[wW]+/) ? true : false;
    const containsSouth = coordinate.match(/[sS]+/) ? true : false;
    const parts = coordinate.match(/-?[0-9.]+/g);
    if (!parts) throw new Error('Not valid coordinates');
    const numbers = parts.map((part) => parseFloat(part));

    // The user must be passing in D.D with only two sets of numbers
    if (numbers.length === 2) {
      this.latitudeWhole = Math.floor(Math.abs(numbers[0]));
      this.longitudeWhole = Math.floor(Math.abs(numbers[1]));
      this.latitudeDecimal = numbers[0] % 1;
      this.longitudeDecimal = numbers[1] % 1;
      if ((containsSouth || numbers[0] < 0) && this.latitudeWhole > 0) this.latitudeWhole = this.latitudeWhole * -1;
      if ((containsWest || numbers[1] < 0) && this.longitudeWhole > 0) this.longitudeWhole = this.longitudeWhole * -1;
      if (this.latitudeWhole < 0 && this.latitudeDecimal > 0) this.latitudeDecimal = this.latitudeDecimal * -1;
      if (this.longitudeWhole < 0 && this.longitudeDecimal > 0) this.longitudeDecimal = this.longitudeDecimal * -1;
      this.detected = 'D.D';

      // The user is passing in D M.M
    } else if (numbers.length === 4) {
      if (numbers[1] < 0 || numbers[3] < 0 || numbers[1] > 60 || numbers[3] > 60)
        throw new Error('Not valid coordinates');
      this.latitudeWhole = Math.floor(numbers[0]);
      this.longitudeWhole = Math.floor(numbers[2]);
      this.latitudeDecimal = numbers[1] / 60;
      this.longitudeDecimal = numbers[3] / 60;
      if ((containsSouth || numbers[0] < 0) && this.latitudeWhole > 0) this.latitudeWhole = this.latitudeWhole * -1;
      if ((containsWest || numbers[2] < 0) && this.longitudeWhole > 0) this.longitudeWhole = this.longitudeWhole * -1;
      if (this.latitudeWhole < 0 && this.latitudeDecimal > 0) this.latitudeDecimal = this.latitudeDecimal * -1;
      if (this.longitudeWhole < 0 && this.longitudeDecimal > 0) this.longitudeDecimal = this.longitudeDecimal * -1;
      this.detected = 'D M.M';

      // The user is passing in D M S.S
    } else if (numbers.length === 6) {
      if (
        numbers[1] < 0 ||
        numbers[2] < 0 ||
        numbers[4] < 0 ||
        numbers[5] < 0 ||
        numbers[1] > 60 ||
        numbers[2] > 60 ||
        numbers[4] > 60 ||
        numbers[5] > 60
      )
        throw new Error('Not valid coordinates');
      this.latitudeWhole = Math.floor(numbers[0]);
      this.longitudeWhole = Math.floor(numbers[3]);
      this.latitudeDecimal = numbers[1] / 60 + numbers[2] / 3600;
      this.longitudeDecimal = numbers[4] / 60 + numbers[5] / 3600;
      if ((containsSouth || numbers[0] < 0) && this.latitudeWhole > 0) this.latitudeWhole = this.latitudeWhole * -1;
      if ((containsWest || numbers[3] < 0) && this.longitudeWhole > 0) this.longitudeWhole = this.longitudeWhole * -1;
      if (this.latitudeWhole < 0 && this.latitudeDecimal > 0) this.latitudeDecimal = this.latitudeDecimal * -1;
      if (this.longitudeWhole < 0 && this.longitudeDecimal > 0) this.longitudeDecimal = this.longitudeDecimal * -1;
      this.detected = 'D M S.S';
    } else {
      throw new Error('Not valid coordinates');
    }

    if (this.latitudeWhole > 90 || this.latitudeWhole < -90 || this.longitudeWhole > 180 || this.longitudeWhole < -180)
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
        let string = mgrs.forward([this.longitude, this.latitude], 5);
        string = string.slice(0, 3) + ' ' + string.slice(3, 5) + ' ' + string.slice(5, 10) + ' ' + string.slice(10);
        return string;
    }
  }

  toLatLonObject(): { latitude: number; longitude: number } {
    return { latitude: this.latitude, longitude: this.longitude };
  }

  get latitude() {
    return this.latitudeWhole + this.latitudeDecimal;
  }

  get longitude() {
    return this.longitudeWhole + this.longitudeDecimal;
  }

  // Returns N 34.54 W 113.24
  get degreesDecimalDegrees() {
    const latDeg = Math.abs(this.latitudeWhole);
    const lngDeg = Math.abs(this.longitudeWhole);
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitudeWhole < 0) latHemisphere = 'S';
    if (this.longitudeWhole < 0) lngHemisphere = 'W';

    const latDecimalSplit = roundAndTruncate(this.latitudeDecimal, 6).split('.');
    let latDecimal = latDecimalSplit?.[1] ?? '';
    if (latDecimal) latDecimal = '.' + latDecimal;

    const lngDecimalSplit = roundAndTruncate(this.longitudeDecimal, 6).split('.');
    let lngDecimal = lngDecimalSplit?.[1] ?? '';
    if (lngDecimal) lngDecimal = '.' + lngDecimal;

    return `${latHemisphere} ${latDeg}${latDecimal} ` + `${lngHemisphere} ${lngDeg}${lngDecimal}`;
  }

  // Returns N 34 50.2 W 116 32.4
  get degreesMinutesDecimalMinutes() {
    const latMin = Math.abs(this.latitudeDecimal * 60);
    const lngMin = Math.abs(this.longitudeDecimal * 60);
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitude < 0) {
      latHemisphere = 'S';
    }
    if (this.longitude < 0) {
      lngHemisphere = 'W';
    }
    return (
      `${latHemisphere} ${Math.abs(this.latitudeWhole)} ${roundAndTruncate(latMin, 4, 2)} ` +
      `${lngHemisphere} ${Math.abs(this.longitudeWhole)} ${roundAndTruncate(lngMin, 4, 2)}`
    );
  }

  // Returns N 39 50 24.23 W 115 34 23.9
  get degreesMinutesSecondsDecimalSeconds() {
    const latMin = Math.abs(this.latitudeDecimal) * 60;
    const latMinFloor = Math.floor(latMin);
    const latSec = latMinFloor === 0 ? latMin * 60 : (latMin % latMinFloor) * 60;

    const lngMin = Math.abs(this.longitudeDecimal) * 60;
    const lngMinFloor = Math.floor(lngMin);
    const lngSec = lngMinFloor === 0 ? lngMin * 60 : (lngMin % lngMinFloor) * 60;
    let latHemisphere = 'N';
    let lngHemisphere = 'E';
    if (this.latitude < 0) {
      latHemisphere = 'S';
    }
    if (this.longitude < 0) {
      lngHemisphere = 'W';
    }
    return (
      `${latHemisphere} ${Math.abs(this.latitudeWhole)} ${roundAndTruncate(latMinFloor, 2, 2)} ${roundAndTruncate(
        latSec,
        2,
        2
      )} ` +
      `${lngHemisphere} ${Math.abs(this.longitudeWhole)} ${roundAndTruncate(lngMinFloor, 2, 2)} ${roundAndTruncate(
        lngSec,
        2,
        2
      )}`
    );
  }
}

export default Coordinate;
