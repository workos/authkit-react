import * as React from 'react';
import { Context } from './context';
import { initialState } from './state';

export function useAuth() {
  const context = React.useContext(Context);

  if (context === initialState) {
    throw new Error('useAuth must be used within an AuthKitProvider');
  }

  return context;
}
