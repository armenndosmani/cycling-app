import type { Ride } from '@/api/rides';
import type { RideForm } from '@/rides/rideForm';

/**
 * The ride being created or edited, shared by the form and its helper screens (meeting point
 * on the map, attach a route). Kept in memory only and cleared when the form closes and on
 * sign-out, because the meeting point can reveal where a rider lives.
 */
export type RideFormState = {
  form: RideForm;
  /** The saved ride; null until a new ride is first saved */
  ride: Ride | null;
} | null;

type Listener = () => void;

export function createRideFormStore() {
  let state: RideFormState = null;
  const listeners = new Set<Listener>();
  const set = (next: RideFormState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: (): RideFormState => state,

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start(form: RideForm, ride: Ride | null): void {
      set({ form, ride });
    },

    update(change: (form: RideForm) => RideForm): void {
      if (!state) return;
      set({ ...state, form: change(state.form) });
    },

    /**
     * After a save: later saves update this ride. An attached route has been copied into the
     * ride, so it is not sent again.
     */
    saved(ride: Ride): void {
      if (!state) return;
      const { form } = state;
      set({
        form: form.route?.routeId ? { ...form, route: { ...form.route, routeId: null } } : form,
        ride,
      });
    },

    reset(): void {
      set(null);
    },
  };
}

export const rideFormStore = createRideFormStore();
