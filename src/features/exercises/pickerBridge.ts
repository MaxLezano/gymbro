/**
 * Tiny one-shot channel so a screen (e.g. the routine builder) can receive the
 * exercises chosen in the picker route without serializing callbacks in params.
 */
type PickerCallback = (exerciseIds: string[]) => void;

let pending: PickerCallback | null = null;

export const pickerBridge = {
  expect(callback: PickerCallback) {
    pending = callback;
  },
  resolve(exerciseIds: string[]) {
    const callback = pending;
    pending = null;
    callback?.(exerciseIds);
  },
  cancel() {
    pending = null;
  },
};
