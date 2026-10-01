import { GoogleMapProvider } from "../../../services/map/google.provider";
import type { LatLng } from "../../../services/map/map.provider";

describe("GoogleMapProvider", () => {
  const provider = new GoogleMapProvider();
  const point: LatLng = { latitude: 30.0444, longitude: 31.2357 };

  it.each([
    ["getRoute", () => provider.getRoute(point, point)],
    ["geocode", () => provider.geocode("Tahrir Square")],
    ["reverseGeocode", () => provider.reverseGeocode(point)],
    ["searchPlaces", () => provider.searchPlaces("coffee", point)],
  ] as const)("%s is not implemented", async (_name, call) => {
    await expect(call()).rejects.toThrow("Google provider not implemented");
  });
});
