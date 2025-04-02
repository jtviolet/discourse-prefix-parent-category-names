import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  console.log("Category Prefixer: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Category Prefixer: No categories configured");
    return;
  }

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

  // Store the original banner texts (as a global in-memory cache)
  const originalBannerTexts = {};
  
  // Function to update the category banner title
  const updateCategoryBannerTitle = () => {
    // We need to verify we're on a category page first
    const isCategory = document.body.classList.contains("category");
    
    // If we're not on a category page, exit
    if (!isCategory) {
      return;
    }
    
    // Get category info from the discovery service
    const discoveryService = api.container.lookup("service:discovery");
    const category = discoveryService?.category;
    
    if (!category) {
      console.log("Category Prefixer: Could not get category from discovery service");
      return;
    }
    
    const categoryId = category.id;
    console.log("Category Prefixer: Current category ID:", categoryId, "Name:", category.name);
    
    // Find the banner title using various selectors
    const possibleSelectors = [
      "h1.custom-banner__title",
      ".custom-banner__title",
      ".category-title h1",
      ".category-heading h1"
    ];
    
    let bannerTitle = null;
    
    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        bannerTitle = element;
        console.log(`Category Prefixer: Found banner with selector: ${selector}`);
        break;
      }
    }
    
    if (!bannerTitle) {
      console.log("Category Prefixer: Could not find any banner title element");
      return;
    }
    
    // Get the current title text
    const currentTitle = bannerTitle.textContent.trim();
    console.log("Category Prefixer: Current banner title:", currentTitle);
    
    // Always reset the banner to the category name first
    // This ensures we don't accumulate prefixes
    bannerTitle.textContent = category.name;
    console.log(`Category Prefixer: Reset banner title to category name: "${category.name}"`);
    
    // If this is not one of our enabled categories or it doesn't have a parent, we're done
    if (!enabledCategories.includes(categoryId)) {
      console.log("Category Prefixer: Category not in enabled list:", categoryId);
      return;
    }
    
    // Check if it has a parent category
    if (!category.parent_category_id) {
      console.log("Category Prefixer: Category doesn't have a parent, using original name");
      return;
    }
    
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
    
    if (!parentCategory) {
      console.log("Category Prefixer: Parent category not found");
      return;
    }
    
    console.log("Category Prefixer: Parent category:", parentCategory.name);
    
    // Update the title to include the parent category name
    bannerTitle.textContent = `${parentCategory.name} ${category.name}`;
    console.log(`Category Prefixer: Updated banner title to "${bannerTitle.textContent}"`);
  };

  // Function to apply all updates
  const applyUpdates = () => {
    console.log("Category Prefixer: Applying updates");
    updateSidebarCategoryNames();
    updateCategoryBannerTitle();
  };

  // Run once on initialization with a delay to ensure DOM is ready
  setTimeout(applyUpdates, 1000);

  // Update when page changes
  api.onPageChange(() => {
    console.log("Category Prefixer: Page change detected");
    
    // Try to update multiple times to ensure the DOM is ready
    setTimeout(applyUpdates, 300);
    setTimeout(applyUpdates, 1000);
    setTimeout(applyUpdates, 2000);
  });
  
  // Add custom event handler to observe DOM changes
  const setupDomObserver = () => {
    // Function to check if an element is the banner title or contains it
    const isBannerElement = (element) => {
      if (!element || !element.tagName) return false;
      
      // Check if it's the banner itself
      if (element.tagName === 'H1' && 
          (element.classList.contains('custom-banner__title') || 
           element.classList.contains('category-title'))) {
        return true;
      }
      
      // Check if it contains the banner
      return !!element.querySelector && !!element.querySelector('h1.custom-banner__title, .category-title h1');
    };
    
    // Create a mutation observer to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      // Check if any mutations are relevant to our elements
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check added nodes
          Array.from(mutation.addedNodes).forEach(node => {
            if (isBannerElement(node)) {
              shouldUpdate = true;
            }
          });
          
          // Check modified nodes
          Array.from(mutation.removedNodes).forEach(node => {
            if (isBannerElement(node)) {
              // If banner was removed, it might be replaced soon
              shouldUpdate = true;
            }
          });
        }
      });
      
      if (shouldUpdate) {
        console.log("Category Prefixer: Banner element modified, updating...");
        setTimeout(updateCategoryBannerTitle, 100);
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { 
      childList: true, 
      subtree: true
    });
    
    console.log("Category Prefixer: DOM observer setup complete");
  };
  
  // Set up the DOM observer after a short delay
  setTimeout(setupDomObserver, 2000);
  
  // Also run updates when app events occur
  api.onAppEvent("page:changed", () => {
    console.log("Category Prefixer: page:changed event");
    setTimeout(applyUpdates, 500);
  });
});