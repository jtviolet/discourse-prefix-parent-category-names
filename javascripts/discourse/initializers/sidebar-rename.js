import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  // Log enabled categories for debugging
  console.log("Category Prefixer: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Category Prefixer: No categories configured");
    return;
  }

  // Helper function to get current category info using the discovery service
  const getCurrentCategoryInfo = () => {
    // Use the discovery service
    const discoveryService = api.container.lookup("service:discovery");
    const currentRoute = discoveryService?.route;
    
    // First check if we're on a category route
    if (!currentRoute || !currentRoute.includes("category")) {
      return null;
    }
    
    // Get the current category from the discoveryService
    const category = discoveryService?.category;
    if (!category) {
      return null;
    }
    
    // Check if this is one of our enabled categories
    if (!enabledCategories.includes(category.id)) {
      return null;
    }
    
    // Return the category info
    return category;
  };

  // Function to update sidebar category names with parent category names
  const updateSidebarCategoryNames = () => {
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) {
      return;
    }
    
    // Find all sidebar category links
    const sidebarCategoryLinks = document.querySelectorAll(".sidebar-section-link-wrapper a.sidebar-section-link");
    
    sidebarCategoryLinks.forEach(link => {
      // Extract category ID from the link's href attribute
      const href = link.getAttribute("href");
      if (!href || !href.includes("/c/")) return;
      
      const match = href.match(/\/c\/(?:.*\/)?(\d+)/);
      if (!match || !match[1]) return;
      
      const categoryId = parseInt(match[1], 10);
      
      // Check if this is one of our enabled categories
      if (!enabledCategories.includes(categoryId)) return;
      
      // Find the category in the site categories
      const category = siteCategories.find(cat => cat.id === categoryId);
      if (!category) return;
      
      // Check if it has a parent category
      if (!category.parent_category_id) return;
      
      // Find the parent category
      const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
      if (!parentCategory) return;
      
      // Get the span that contains the category name
      const nameSpan = link.querySelector(".sidebar-section-link-content-text");
      if (!nameSpan) return;
      
      // Get the current text and check if it already has the parent name
      const currentText = nameSpan.textContent.trim();
      
      // Get the original category name (without parent prefix)
      const categoryName = category.name;
      
      // If currentText already includes the parent name, don't add it again
      if (currentText.startsWith(parentCategory.name)) return;
      
      // Check if text already contains the parent prefix to avoid duplication
      if (currentText === categoryName) {
        // Update the name to include the parent category name
        nameSpan.textContent = `${parentCategory.name} ${categoryName}`;
        console.log(`Category Prefixer: Updated sidebar category name to "${nameSpan.textContent}"`);
      }
    });
  };

  // Function to update the banner title with parent category prefix
  const updateBannerTitle = () => {
    // Get current category info
    const currentCategory = getCurrentCategoryInfo();
    if (!currentCategory) {
      console.log("Category Prefixer: Not on a valid category page or category not enabled");
      return;
    }
    
    console.log("Category Prefixer: Current category detected:", currentCategory.name, "ID:", currentCategory.id);
    
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) return;
    
    // Check if it has a parent category
    if (!currentCategory.parent_category_id) {
      console.log("Category Prefixer: Category doesn't have a parent");
      return;
    }
    
    // Find the parent category
    const parentCategory = siteCategories.find(cat => cat.id === currentCategory.parent_category_id);
    if (!parentCategory) {
      console.log("Category Prefixer: Parent category not found");
      return;
    }
    
    console.log("Category Prefixer: Parent category found:", parentCategory.name, "ID:", parentCategory.id);
    
    // Directly target the h1 with class custom-banner__title as specified
    const bannerTitle = document.querySelector("h1.custom-banner__title");
    
    if (!bannerTitle) {
      console.log("Category Prefixer: Could not find banner title element with h1.custom-banner__title");
      return;
    }
    
    console.log("Category Prefixer: Found banner title element:", bannerTitle.textContent);
    
    // Get the current title text
    const originalTitle = bannerTitle.textContent.trim();
    console.log("Category Prefixer: Original title:", originalTitle);
    
    // Get the original category name
    const categoryName = currentCategory.name;
    
    // If title already includes the parent name, don't add it again
    if (originalTitle.startsWith(parentCategory.name)) {
      console.log("Category Prefixer: Title already has parent prefix, skipping");
      return;
    }
    
    // Update the title to include the parent category name
    const newTitle = `${parentCategory.name} ${categoryName}`;
    bannerTitle.textContent = newTitle;
    console.log(`Category Prefixer: Updated banner title to "${newTitle}"`);
  };

  // Watch for DOM changes to update sidebar category names
  api.onAppEvent("page:changed", () => {
    console.log("Category Prefixer: page:changed event triggered");
    // Use a short delay to ensure sidebar is fully rendered
    setTimeout(() => {
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 300);
  });
  
  // Handle DOM mutations to detect when the banner gets added/changed
  const setupMutationObserver = () => {
    console.log("Category Prefixer: Setting up mutation observer");
    
    // Create a mutation observer
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      // Check if any of these mutations are relevant to our banner
      mutations.forEach((mutation) => {
        // If we see h1 elements being added or modified
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          // Check if any added node is our banner or contains our banner
          addedNodes.forEach(node => {
            if (node.querySelector && node.querySelector('h1.custom-banner__title')) {
              shouldUpdate = true;
            }
            // Check if the node itself is the banner
            if (node.tagName === 'H1' && node.classList.contains('custom-banner__title')) {
              shouldUpdate = true;
            }
          });
        }
      });
      
      if (shouldUpdate) {
        console.log("Category Prefixer: Banner title element changed, updating...");
        updateBannerTitle();
      }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });
    
    console.log("Category Prefixer: Mutation observer set up");
  };
  
  // Run once on initialization with a delay to ensure DOM is ready
  setTimeout(() => {
    console.log("Category Prefixer: Initial load");
    updateSidebarCategoryNames();
    updateBannerTitle();
    setupMutationObserver();
  }, 1000);

  // Update sidebar and banner when page changes
  api.onPageChange(() => {
    console.log("Category Prefixer: Page change detected");
    
    // Try multiple times with increasing delays to catch when the DOM is actually ready
    setTimeout(() => {
      console.log("Category Prefixer: First attempt after page change");
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 300);
    
    setTimeout(() => {
      console.log("Category Prefixer: Second attempt after page change");
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 1000);
    
    setTimeout(() => {
      console.log("Category Prefixer: Third attempt after page change");
      updateSidebarCategoryNames();
      updateBannerTitle();
    }, 2000);
  });
});