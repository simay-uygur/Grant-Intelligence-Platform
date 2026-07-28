import { createFileRoute } from "@tanstack/react-router";
import { App } from "frontend/src/components/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grant Navigator — European grant discovery, intelligently matched" },
      {
        name: "description",
        content:
          "AI-powered chat assistant that helps SMEs, startups, NGOs, universities and public bodies discover the best European grant opportunities and prepare applications.",
      },
      {
        property: "og:title",
        content: "Grant Navigator — European grant discovery",
      },
      {
        property: "og:description",
        content:
          "Chat with an AI grant consultant. Get the three best-matched European grants and draft your application in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});
