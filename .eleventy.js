export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("wallpapers");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/thumbs");

  eleventyConfig.addWatchTarget("src/");
  eleventyConfig.addWatchTarget("wallpapers/");

  return {
    pathPrefix: process.env.ELEVENTY_PATH_PREFIX || "/",
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
  };
}
