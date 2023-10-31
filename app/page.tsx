import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  return (<>

    <ChatWindow
      emoji="🏠"
      titleText="Description Generator AI"
      placeholder="Try asking something about the document you just uploaded!"
    ></ChatWindow>
  </>
  );
}
