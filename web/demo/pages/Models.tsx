import { Layout } from "../ui/Layout";
import { mount } from "../ui/mount";

function Models() {
  return (
    <Layout page="models">
      <p>
        Open-source Nodd models, hosted on Hugging Face. Download, reuse and adapt them for your own projects,
        or submit your own model to the catalog.
      </p>
      <p>
        <a href="https://huggingface.co/spaces/nodd-repo/community">Browse the catalog on Hugging Face →</a>
      </p>
    </Layout>
  );
}

mount(<Models />);
