import { Props } from './types';
import { Operation } from '@hautechai/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCollectionStacks } from '../../data';
import { getImageFromStack } from './utils';

const useLogic = (props: Props) => {
    const scrollController = useRef<{ scrollToTop: () => void } | undefined>(undefined);

    const [selectedStackId, setSelectedStackId] = useState<string | null>(null);

    const stacksAPI = useCollectionStacks(props.widgetProps.collectionId);
    const stacks = stacksAPI.read();

    const [loading, setLoading] = useState(false);

    const onGetImages = useCallback(async () => {
        const visibleStacks = stacks.value.filter((stack) =>
            stack.operations.some((operation) => operation.type === 'select.v1' && operation.status === 'finished'),
        );
        return visibleStacks.map((stack) => getImageFromStack(stack)).filter((imageId) => !!imageId) as string[];
    }, [stacks.value]);

    const onStart = useCallback(async () => {
        const shouldScroll = stacks.value.length > 0;
        setLoading(true);

        try {
            let prompt = props.widgetProps.input.prompt;
            if (!prompt) {
                let proposePromptOperation = await props.sdk.operations.create.proposePrompt.v1({
                    input: { imageId: props.widgetProps.input.productImageId },
                });
                proposePromptOperation = await props.sdk.operations.wait({ id: proposePromptOperation.id });
                if (!proposePromptOperation.output?.text) throw new Error('Failed to propose prompt');
                prompt = proposePromptOperation.output.text;
            }

            let operation = await props.sdk.operations.create.generate.v1({
                input: {
                    aspectRatio: props.widgetProps.input.aspectRatio ?? '1:1',
                    modelId: props.widgetProps.input.modelId ?? '1',
                    productImageId: props.widgetProps.input.productImageId,
                    prompt,
                    quality: props.widgetProps.input.quality ?? 'high',
                    seed: props.widgetProps.input.seed ?? props.sdk.utils.seed(),
                },
            });
            operation = await props.sdk.operations.wait({ id: operation.id });

            for (const imageId of operation.output?.imageIds ?? []) {
                const newOperation = await props.sdk.operations.create.select.v1({ input: { imageId } });
                const newStack = await stacksAPI.create();
                await stacksAPI.addOperations({
                    id: newStack.id,
                    operationIds: [operation.id, newOperation.id],
                });
            }

            if (shouldScroll) setTimeout(() => scrollController.current?.scrollToTop(), 500);
        } finally {
            setLoading(false);
        }
    }, [props.widgetProps.input, stacks.value]);

    const onDeselectStack = useCallback(() => setSelectedStackId(null), []);
    const onDownloadImage = useCallback(
        async (imageId: string) => {
            await props.widgetMethods.downloadImage({ imageId });
        },
        [props.widgetMethods.downloadImage],
    );
    const onInitScrollController = useCallback((controller: { scrollToTop: () => void } | undefined) => {
        scrollController.current = controller;
    }, []);
    const onSelectStack = useCallback((stackId: string) => setSelectedStackId(stackId), []);

    useEffect(() => {
        props.setIncomingMethodHandlers({
            getImages: onGetImages,
            start: onStart,
        });
    }, [onGetImages, onStart]);

    useEffect(() => {
        const callback = (operation: Operation<any, any>) => stacksAPI.updateOperation(operation);
        props.sdk.operations.updates.subscribe({ callback });
        return () => props.sdk.operations.updates.unsubscribe({ callback });
    }, []);

    return {
        loading,
        onDeselectStack,
        onDownloadImage,
        onInitScrollController,
        onSelectStack,
        selectedStackId,
        stacks: stacks.value,
    };
};

export default useLogic;
