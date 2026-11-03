type LocationSource = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;

// A watch belongs to the driver who started it, never to a selected map marker.
export class DriverLocationWatch {
  private watchId: number | null = null;
  private generation = 0;

  constructor(
    private source: LocationSource,
    private onPosition: (driverId: string, position: GeolocationPosition) => void,
    private onError: (error: GeolocationPositionError) => void
  ) {}

  start(driverId: string) {
    this.stop();
    if (!driverId) return;
    const generation = this.generation;
    const watchId = this.source.watchPosition(
      (position) => {
        if (generation === this.generation) this.onPosition(driverId, position);
      },
      (error) => {
        if (generation !== this.generation) return;
        if (error.code === 1) this.stop();
        this.onError(error);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    // Also handle sources that invoke a terminal error before returning an ID.
    if (generation === this.generation) this.watchId = watchId;
    else this.source.clearWatch(watchId);
  }

  stop() {
    this.generation++;
    if (this.watchId !== null) this.source.clearWatch(this.watchId);
    this.watchId = null;
  }
}
