import { useState } from "react";
import HtmlEditor from "@/components/HtmlEditor";
import LoginScreen from "@/components/LoginScreen";

const Index = () => {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return <HtmlEditor />;
};

export default Index;
