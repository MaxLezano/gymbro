import React, { useEffect, useRef } from 'react';
import { View, ViewProps } from 'react-native';
import { registerTarget } from './tour';

/** Marks a view the tutorial can spotlight. Renders a plain View. */
export function TourTarget({ id, ...rest }: ViewProps & { id: string }) {
  const ref = useRef<View>(null);
  useEffect(() => registerTarget(id, ref), [id]);
  // collapsable=false: Android must keep a real native view to measure.
  return <View ref={ref} collapsable={false} {...rest} />;
}
