import '@testing-library/react-native/matchers';
import { configure } from '@testing-library/react-native';

// CI runners are slower than the 2s waitFor default; the auth-screen
// flows poll async handlers and can exceed it under load.
configure({ asyncUtilTimeout: 10000 });
