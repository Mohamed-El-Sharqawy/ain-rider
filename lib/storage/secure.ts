import * as SecureStore from 'expo-secure-store';

export const StorageKeys = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
};

export const SecureStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(StorageKeys.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(StorageKeys.REFRESH_TOKEN, refreshToken),
    ]);
  },
  
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(StorageKeys.ACCESS_TOKEN);
  },
  
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(StorageKeys.REFRESH_TOKEN);
  },
  
  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(StorageKeys.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(StorageKeys.REFRESH_TOKEN),
    ]);
  }
};
