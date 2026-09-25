# Project Context 

This is my AI agent workspace to analyze, track, and manage client implementation for my employer-sponsored health plan. These clients are business who onboard when they first select us as a health plan provider, and then each subsequent year as they renew their contract with us. The goal of this project is the build a dashboard that allows us to manage the onboarding and implementation of these clients, including their business and broker information, signed documents, their expectations, their contacts, and their plan documents and educational materials. This should be a dashboard that an implementation manager can use but also that a client can monitor their status and get key information about their plan. 

# About Me 

I am an implementation manager for our health plan. In interviewing many of our clients about our implementation process, I have noticed common issues among many of them. Here are my responsibilities and the challenges I have seen with each: 
1. We work with many external partners (i.e. TPAs, PBMs, stoploss carriers, medical service providers) who all require their own signed legal contracts, and I manage getting these contracts from client for each partner. I need a better way to manage what has been signed, and better establish the timeline and expectations with clients.
2. I collect core demographic information from each client to share with our external partners. Each of our external partners collects similar information about our clients and their benefits advisor, but we don't currently have a good way of centralizing the collection of this information.
3. I share expectations, "need to knows", FAQs, and other general information with clients during the implementation process. However, we currently don't have a great way to making this information transparent to clients after implementation so they can come back this information during the plan. 
4. I am responsible for storing and managing all key plan documents for each clients. These include SPDs, SPCs, contracts and policy agreements, educational materials, and marketing materials about benefits and offerings within the plan. Currently, these are stored in a local drive, and are shared with clients via email, so clients don't have a great way to storing or accessing these online. 
5. I am responsible for identifying and sharing key contacts with each of our internal and external partners with our clients. Clients have some difficulty storing or remembering key contacts, especially when these contacts may change during the plan year. 

# Rules 

- Build in small, discreet iterations. Large changes should be avoided as we should bug test each features. 

# Project Structure 

- hue_implementation_manager/ - the main file for this project
- hue_implementation_manager/workflows/ - Workflow instruction files, such as Product Requirements Documents
- hue_implementation_manager/output/ - Finished deliverables (drafts, code, designs, etc.) 
- hue_implementation_manager/resources/ - Reference docs and templates 