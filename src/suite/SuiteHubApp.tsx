import { SuiteHubProvider } from './SuiteHubContext';
import App from '../App';

/** Entry point buildu `suite` — pełny hub jak hub-platform. */
export function SuiteHubApp() {
  return (
    <SuiteHubProvider>
      <App />
    </SuiteHubProvider>
  );
}
