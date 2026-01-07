import { VideoCall } from '@/components/VideoCall';
import { Toaster } from 'sonner';

function App() {
  return <>
  <Toaster position="bottom-center" richColors />
  <VideoCall />
  </>;
}

export default App;
