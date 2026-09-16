import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import "./index.css";

export function App() {
  return (
    <main className="fixed inset-0 flex items-center justify-center p-4">
      <Card className="w-[min(100%,28rem)]">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-6xl font-normal text-primary">FRONG</CardTitle>
          <CardDescription>QWOP, but you're a frog and you're hungry. Coming soon.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

export default App;
