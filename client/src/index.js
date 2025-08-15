import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './redux/store';
import ErrorBoundary from './components/UI/ErrorBoundary';
import FallbackApp from './components/UI/FallbackApp';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap the main app with error handling
const AppWithErrorHandling = () => {
  try {
    return (
      <ErrorBoundary>
        <Provider store={store}>
          <BrowserRouter>
            <HelmetProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </HelmetProvider>
          </BrowserRouter>
        </Provider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Failed to render main app:', error);
    return <FallbackApp />;
  }
};

root.render(
  <React.StrictMode>
    <AppWithErrorHandling />
  </React.StrictMode>
);
